import { ensureDbReady } from "../db.js";
import { getUserKeywords, runDailyJobCheck } from "../services/notifier.js";

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

  try {
    if (runDailyInProgress) {
      console.log("[run-daily] Already running", requestSource);
      return res.status(202).json({
        accepted: true,
        running: true,
        message: "Daily job check is already running",
      });
    }

    if (runInBackground) {
      runDailyInProgress = true;
      res.status(202).json({
        accepted: true,
        running: true,
        message: "Daily job check started",
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

    res.json(result);
  } catch (error) {
    runDailyInProgress = false;
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
