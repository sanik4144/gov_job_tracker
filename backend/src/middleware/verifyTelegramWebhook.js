import crypto from "node:crypto";
import { env } from "../config/env.js";

function safeEqual(a = "", b = "") {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));

  // timingSafeEqual throws on length mismatch, so compare lengths first.
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

/**
 * The webhook is a public, unauthenticated URL. Telegram echoes the `secret_token`
 * given to setWebhook in this header; without checking it, anyone who guesses the
 * path could post a forged update and bind their own chat to someone's account.
 */
export function verifyTelegramWebhook(req, res, next) {
  if (!env.telegramWebhookSecret) {
    console.error("[telegram] TELEGRAM_WEBHOOK_SECRET is not set — rejecting update");
    return res.sendStatus(403);
  }

  if (!safeEqual(req.header("x-telegram-bot-api-secret-token"), env.telegramWebhookSecret)) {
    console.warn("[telegram] Rejected update with a bad secret token", { ip: req.ip });
    return res.sendStatus(403);
  }

  return next();
}

/**
 * Small fixed-window limiter. Telegram itself is well behaved; this is here to blunt
 * anyone hammering the public path.
 */
export function rateLimitTelegramWebhook({ windowMs = 60_000, max = 120 } = {}) {
  const hits = new Map();

  return function limiter(req, res, next) {
    const now = Date.now();
    const key = req.ip || "unknown";
    const entry = hits.get(key);

    if (!entry || now > entry.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
    } else if (++entry.count > max) {
      return res.sendStatus(429);
    }

    // Opportunistic sweep so the map cannot grow without bound.
    if (hits.size > 1000) {
      for (const [ip, value] of hits) {
        if (now > value.resetAt) hits.delete(ip);
      }
    }

    return next();
  };
}
