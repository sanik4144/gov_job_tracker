import { PLANS } from "../config/plans.js";
import { ensureDbReady } from "../db.js";
import { getUserKeywords, runDailyJobCheck } from "../services/notifier.js";
import { consumeManualScan, refundManualScan } from "../services/scanQuota.js";
import { sendPlanLimit } from "../utils/planErrors.js";

let runDailyInProgress = false;

export async function runCheck(req, res, next) {
  const startedAt = Date.now();
  const isExternalCronRequest = !req.header("origin") && Boolean(req.header("x-cron-secret"));
  const runInBackground =
    isExternalCronRequest ||
    req.query.background === "true" ||
    req.body?.background === true ||
    req.body?.async === true;
  const requestSource = {
    origin: req.header("origin") || "no-origin",
    userAgent: req.header("user-agent") || "unknown",
    ip: req.ip,
  };

  console.log("[run-daily] Request received", {
    ...requestSource,
    notify: req.body?.notify !== false,
    background: runInBackground,
    time: new Date().toISOString(),
  });

  // Declared out here so the catch below can refund a scan the run never used.
  let quota = null;

  try {
    if (runDailyInProgress) {
      console.log("[run-daily] Already running", requestSource);
      return res.status(202).json({
        accepted: true,
        running: true,
        message: "Daily job check is already running",
      });
    }

    // Metered only for signed-in users. Cron requests carry no user and are not
    // charged against anyone's allowance.
    if (req.user) {
      await ensureDbReady();
      quota = await consumeManualScan(req.user);

      if (!quota.allowed) {
        console.log("[run-daily] Scan quota exhausted", {
          userId: String(req.user._id),
          limit: quota.limit,
        });

        return sendPlanLimit(res, {
          feature: "manualScansPerDay",
          limit: quota.limit,
          message:
            `You have used today's ${quota.limit} manual scan${quota.limit === 1 ? "" : "s"}. ` +
            `Upgrade to Pro for ${PLANS.pro.limits.manualScansPerDay} scans a day.`,
        });
      }
    }

    if (runInBackground) {
      runDailyInProgress = true;
      res.status(202).json({
        accepted: true,
        running: true,
        message: "Daily job check started",
        scanQuota: quota,
      });

      setImmediate(async () => {
        try {
          await ensureDbReady();
          const result = await executeRunCheck(req);
          console.log("[run-daily] Background completed", {
            durationMs: Date.now() - startedAt,
            keywords: result.keywords,
            found: result.found,
            new: result.new,
            notificationError: result.notificationError,
          });
        } catch (error) {
          // A run that never happened should not cost a scan, least of all a free
          // user's only one for the day.
          await refundManualScan(req.user, quota?.day);
          console.error("[run-daily] Background failed", {
            durationMs: Date.now() - startedAt,
            message: error.message,
          });
        } finally {
          runDailyInProgress = false;
        }
      });

      return;
    }

    runDailyInProgress = true;
    await ensureDbReady();
    const result = await executeRunCheck(req);
    runDailyInProgress = false;
    console.log("[run-daily] Completed", {
      durationMs: Date.now() - startedAt,
      keywords: result.keywords,
      found: result.found,
      new: result.new,
      notificationError: result.notificationError,
    });

    res.json({ ...result, scanQuota: quota });
  } catch (error) {
    runDailyInProgress = false;
    await refundManualScan(req.user, quota?.day);
    console.error("[run-daily] Failed", {
      durationMs: Date.now() - startedAt,
      message: error.message,
    });
    next(error);
  }
}

async function executeRunCheck(req) {
  const userKeywords = req.user ? await getUserKeywords(req.user._id) : null;

  return runDailyJobCheck({
    notify: req.body?.notify !== false,
    keywords: userKeywords,
    notifyUserId: req.user?._id,
  });
}
