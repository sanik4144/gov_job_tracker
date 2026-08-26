import cron from "node-cron";
import { env } from "./config/env.js";
import { runDueUserNotificationChecks } from "./services/notifier.js";

export function startScheduler() {
  cron.schedule(
    "* * * * *",
    async () => {
      try {
        const result = await runDueUserNotificationChecks({ timezone: env.timezone });
        if (result.due > 0) {
          console.log("Ran scheduled user notification checks", {
            due: result.due,
            checkedAt: result.checkedAt,
          });
        }
      } catch (error) {
        console.error("Scheduled user notification check failed:", error);
      }
    },
    {
      timezone: env.timezone,
    }
  );

  console.log(`Scheduler registered: every minute (${env.timezone})`);
}
