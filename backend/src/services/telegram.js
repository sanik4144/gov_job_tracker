import axios from "axios";
import { env } from "../config/env.js";

const RETRYABLE_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ENETUNREACH",
  "EHOSTUNREACH",
  "ETIMEDOUT",
  "ECONNABORTED",
  "EPIPE",
  "ERR_NETWORK",
]);

/**
 * Builds a message that is never empty.
 *
 * When every resolved address of api.telegram.org fails, Node raises a bare
 * AggregateError whose `.message` is "" — which used to log as a blank line and,
 * being falsy, collapsed to `null` in the API response. So unwrap the parts that
 * actually carry the reason.
 */
export function describeTelegramError(error) {
  const description = error?.response?.data?.description;
  if (description) return description;

  const status = error?.response?.status;
  const nested = error?.errors || error?.cause?.errors;
  if (Array.isArray(nested) && nested.length > 0) {
    const reasons = [...new Set(nested.map((item) => item?.message || item?.code).filter(Boolean))];
    if (reasons.length > 0) return `Could not reach Telegram (${reasons.join("; ")})`;
  }

  if (error?.message) return status ? `${error.message} (HTTP ${status})` : error.message;
  if (error?.cause?.message) return error.cause.message;
  if (error?.code) return `Telegram request failed (${error.code})`;
  if (status) return `Telegram request failed with HTTP ${status}`;

  return `Telegram request failed (${error?.constructor?.name || typeof error})`;
}

function isRetryable(error) {
  const status = error?.response?.status;
  if (status) return status === 429 || status >= 500;

  const codes = [
    error?.code,
    error?.cause?.code,
    ...(error?.errors || error?.cause?.errors || []).map((item) => item?.code),
  ].filter(Boolean);

  // No response at all means it never reached Telegram — always worth another try.
  return codes.some((code) => RETRYABLE_CODES.has(code)) || !error?.response;
}

function getRetryDelayMs(error, attempt) {
  const retryAfter = Number(error?.response?.data?.parameters?.retry_after);
  if (Number.isFinite(retryAfter) && retryAfter > 0) return retryAfter * 1000;

  return Math.min(1000 * 2 ** attempt, 8000);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function sendTelegramMessage(text, chatId, { attempts = 3 } = {}) {
  if (!chatId) {
    throw new Error("Telegram chat ID is required");
  }

  const url = `https://api.telegram.org/bot${env.telegramBotToken}/sendMessage`;
  let lastError = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await axios.post(
        url,
        {
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: false,
        },
        { timeout: 20000 }
      );

      return response.data;
    } catch (error) {
      lastError = error;

      if (attempt === attempts - 1 || !isRetryable(error)) break;

      const delay = getRetryDelayMs(error, attempt);
      console.warn(
        `Telegram send failed (attempt ${attempt + 1}/${attempts}), retrying in ${delay}ms:`,
        describeTelegramError(error)
      );
      await sleep(delay);
    }
  }

  const failure = new Error(describeTelegramError(lastError));
  failure.cause = lastError;
  failure.telegramStatus = lastError?.response?.status ?? null;
  throw failure;
}

function apiUrl(method) {
  return `https://api.telegram.org/bot${env.telegramBotToken}/${method}`;
}

/**
 * Registers the webhook. `secret_token` is what Telegram echoes back in the
 * X-Telegram-Bot-Api-Secret-Token header on every update.
 *
 * Note: this permanently disables getUpdates for this bot token.
 */
export async function setTelegramWebhook(url, secretToken) {
  const response = await axios.post(apiUrl("setWebhook"), {
    url,
    secret_token: secretToken,
    allowed_updates: ["message", "edited_message"],
    drop_pending_updates: true,
  });

  return response.data;
}

export async function getTelegramWebhookInfo() {
  const response = await axios.get(apiUrl("getWebhookInfo"));

  return response.data;
}

export async function deleteTelegramWebhook() {
  const response = await axios.post(apiUrl("deleteWebhook"), { drop_pending_updates: false });

  return response.data;
}

export async function getTelegramBotInfo() {
  const response = await axios.get(apiUrl("getMe"));

  return response.data;
}
