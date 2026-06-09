import cron from "node-cron";
import { env } from "./config/env.js";
import { runDailyJobCheck } from "./services/notifier.js";

export function startScheduler() {
  cron.schedule(
    env.dailyCron,
    async () => {
      try {
        console.log("Running scheduled job check");
        await runDailyJobCheck();
      } catch (error) {
        console.error("Scheduled job check failed:", error);
      }
    },
    {
      timezone: env.timezone,
    }
  );

  console.log(`Scheduler registered: ${env.dailyCron} (${env.timezone})`);
}
