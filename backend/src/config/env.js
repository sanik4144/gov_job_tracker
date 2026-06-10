import dotenv from "dotenv";

dotenv.config();

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
  jobSearchUrl:
    process.env.JOB_SEARCH_URL ||
    "https://alljobs.teletalk.com.bd/jobs?keyword=Assistant+Programmer&orgid=1",
  jobKeyword: process.env.JOB_KEYWORD || "Assistant Programmer",
  cronSecret: process.env.CRON_SECRET,
  dailyCron: process.env.DAILY_CRON || "0 9 * * *",
  enableInternalScheduler: process.env.ENABLE_INTERNAL_SCHEDULER !== "false",
  timezone: process.env.TZ || "Asia/Dhaka",
  frontendOrigin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
};

export function requireEnv() {
  const required = ["mongodbUri", "telegramBotToken", "telegramChatId", "cronSecret"];
  const missing = required.filter((key) => !env[key]);

  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}
