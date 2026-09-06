import cron from "node-cron";
import { env } from "./config/env.js";
import { expireLapsedSubscriptions } from "./services/billing.js";
import { runDueUserNotificationChecks } from "./services/notifier.js";

let sweepInProgress = false;

async function runSweep(trigger) {
  // A sweep scrapes the web and can outlive its one-minute tick. Overlapping sweeps
  // would race on the same users, so a slow sweep simply absorbs the next tick.
  if (sweepInProgress) return;

  sweepInProgress = true;
  try {
    const result = await runDueUserNotificationChecks({ timezone: env.timezone });
    if (result.due > 0) {
      console.log("Ran scheduled user notification checks", {
        trigger,
        due: result.due,
        sent: result.sent,
        failed: result.failed,
        checkedAt: result.checkedAt,
      });
    }
  } catch (error) {
    console.error("Scheduled user notification check failed:", error);
  } finally {
    sweepInProgress = false;
  }
}

/**
 * Flips records whose grace window has closed.
 *
 * Cosmetic only: entitlements resolve from the date, so a missed run never grants
 * anyone access they should not have. It keeps the admin view honest.
 */
async function runExpirySweep(trigger) {
  try {
    const result = await expireLapsedSubscriptions();

    if (result.expired > 0) {
      console.log("Expired lapsed subscriptions", { trigger, ...result });
    }
  } catch (error) {
    console.error("Subscription expiry sweep failed:", error);
  }
}

export function startScheduler() {
  cron.schedule("* * * * *", () => runSweep("cron"), { timezone: env.timezone });

  cron.schedule("5 0 * * *", () => runExpirySweep("cron"), { timezone: env.timezone });

  // Deploys and cold starts land in the middle of the day. Sweeping once at boot
  // delivers any slot that came due while the process was down.
  runSweep("startup");
  runExpirySweep("startup");

  console.log(
    `Scheduler registered: every minute (${env.timezone}), ` +
      `catch-up ${env.notificationCatchUpMinutes}m, retry gap ${env.notificationRetryMinutes}m`
  );
}
