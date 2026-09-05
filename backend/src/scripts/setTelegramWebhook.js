/**
 * Registers, inspects, or removes the Telegram webhook.
 *
 *   node src/scripts/setTelegramWebhook.js info
 *   node src/scripts/setTelegramWebhook.js set
 *   node src/scripts/setTelegramWebhook.js delete
 *
 * `set` requires PUBLIC_BACKEND_URL and TELEGRAM_WEBHOOK_SECRET and will disable
 * getUpdates for this bot token — use a separate bot for local development.
 */
import dns from "node:dns";
import { env } from "../config/env.js";
import {
  deleteTelegramWebhook,
  getTelegramBotInfo,
  getTelegramWebhookInfo,
  setTelegramWebhook,
} from "../services/telegram.js";

const WEBHOOK_PATH = "/api/telegram/webhook";

function printInfo(info) {
  const result = info.result || {};
  console.log("  url                 :", result.url || "(none)");
  console.log("  pending updates     :", result.pending_update_count ?? 0);
  console.log("  custom certificate  :", Boolean(result.has_custom_certificate));
  console.log("  max connections     :", result.max_connections ?? "-");
  console.log("  allowed updates     :", (result.allowed_updates || []).join(", ") || "(all)");
  if (result.last_error_message) {
    console.log("  LAST ERROR          :", result.last_error_message);
    console.log("  last error date     :", new Date((result.last_error_date || 0) * 1000).toISOString());
  }
}

async function main() {
  if (env.dnsServers.length) dns.setServers(env.dnsServers);

  const command = (process.argv[2] || "info").toLowerCase();

  if (!env.telegramBotToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is required");
  }

  const bot = await getTelegramBotInfo();
  console.log(`Bot: @${bot.result?.username} (${bot.result?.first_name})\n`);

  if (command === "info") {
    console.log("Current webhook:");
    printInfo(await getTelegramWebhookInfo());
    return;
  }

  if (command === "delete") {
    console.log("Deleting webhook:", (await deleteTelegramWebhook()).description);
    return;
  }

  if (command !== "set") {
    throw new Error(`Unknown command "${command}". Use info, set, or delete.`);
  }

  if (!env.publicBackendUrl) {
    throw new Error("PUBLIC_BACKEND_URL is required to set the webhook");
  }
  if (!env.telegramWebhookSecret) {
    throw new Error("TELEGRAM_WEBHOOK_SECRET is required to set the webhook");
  }
  if (!env.publicBackendUrl.startsWith("https://")) {
    throw new Error("PUBLIC_BACKEND_URL must be https — Telegram refuses plain http");
  }

  const url = `${env.publicBackendUrl}${WEBHOOK_PATH}`;
  const result = await setTelegramWebhook(url, env.telegramWebhookSecret);
  console.log("setWebhook ->", result.description || result.ok);
  console.log("\nWebhook now:");
  printInfo(await getTelegramWebhookInfo());
  console.log("\nNote: getUpdates (long polling) is now disabled for this bot token.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Failed:", error.response?.data?.description || error.message);
    process.exit(1);
  });
