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
  telegramChatId: process.env.TELEGRAM_CHAT_ID,
  jobSearchUrl: process.env.JOB_SEARCH_URL || "https://alljobs.teletalk.com.bd",
  cronSecret: process.env.CRON_SECRET,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  dailyCron: process.env.DAILY_CRON || "0 9 * * *",
  enableInternalScheduler: process.env.ENABLE_INTERNAL_SCHEDULER !== "false",
  timezone: process.env.TZ || "Asia/Dhaka",
  frontendOrigins: (process.env.FRONTEND_ORIGIN || defaultFrontendOrigins.join(","))
    .split(",")
    .map((origin) => normalizeOrigin(origin.trim()))
    .filter(Boolean),
};

export function requireEnv() {
  const required = ["mongodbUri", "telegramBotToken", "telegramChatId", "cronSecret", "jwtSecret"];
  const missing = required.filter((key) => !env[key]);

  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}
