import dotenv from "dotenv";

dotenv.config();

function normalizeOrigin(origin) {
  return origin.replace(/\/+$/, "");
}

const defaultFrontendOrigins = ["http://localhost:5173", "https://gov-job-tracker.vercel.app"];

export const env = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || "development",
  mongodbUri: process.env.MONGODB_URI,
  dnsServers: process.env.DNS_SERVERS
    ? process.env.DNS_SERVERS.split(",")
        .map((server) => server.trim())
        .filter(Boolean)
    : [],
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  jobSearchUrl: process.env.JOB_SEARCH_URL || "https://alljobs.teletalk.com.bd",
  cronSecret: process.env.CRON_SECRET,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  enableInternalScheduler: process.env.ENABLE_INTERNAL_SCHEDULER !== "false",
  // How late a missed schedule slot may still fire. Covers restarts, deploys and
  // sleeping free-tier dynos so a user never silently loses a whole day.
  notificationCatchUpMinutes: Number(process.env.NOTIFICATION_CATCHUP_MINUTES || 360),
  // Minimum gap between retries when a slot's delivery failed and is still catchable.
  notificationRetryMinutes: Number(process.env.NOTIFICATION_RETRY_MINUTES || 10),
  // How far back a user's first digest may reach. Bounds the backlog a brand-new
  // user (or a newly added keyword) pulls in on its first delivery.
  notificationJobLookbackDays: Number(process.env.NOTIFICATION_JOB_LOOKBACK_DAYS || 14),
  timezone: process.env.TZ || "Asia/Dhaka",
  frontendOrigins: (process.env.FRONTEND_ORIGIN || defaultFrontendOrigins.join(","))
    .split(",")
    .map((origin) => normalizeOrigin(origin.trim()))
    .filter(Boolean),
};

export function requireEnv() {
  const required = ["mongodbUri", "telegramBotToken", "cronSecret", "jwtSecret"];
  const missing = required.filter((key) => !env[key]);

  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}
