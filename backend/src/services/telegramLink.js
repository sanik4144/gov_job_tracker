import crypto from "node:crypto";
import { env } from "../config/env.js";
import { TelegramLinkToken } from "../models/TelegramLinkToken.js";
import User from "../models/User.js";

// No 0/O/1/I/L: the code gets retyped by hand on a phone keyboard.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

function generateCode() {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  const chars = [...bytes].map((byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]);

  // Grouped for legibility: ABCD-EFGH
  return `${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

export function normalizeCode(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * Issues a fresh link for one user, replacing any pending one so a user who clicks
 * Connect twice is never left guessing which code is live.
 */
export async function createLinkToken(userId) {
  await TelegramLinkToken.deleteMany({ userId });

  const expiresAt = new Date(Date.now() + env.telegramLinkTtlMinutes * 60 * 1000);

  // Retry on the astronomically unlikely code collision rather than 500.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await TelegramLinkToken.create({
        userId,
        token: crypto.randomBytes(32).toString("base64url"),
        code: generateCode(),
        expiresAt,
      });
    } catch (error) {
      if (error.code !== 11000 || attempt === 4) throw error;
    }
  }

  throw new Error("Could not generate a Telegram link code");
}

export function buildDeepLink(token) {
  if (!env.telegramBotUsername) return null;

  return `https://t.me/${env.telegramBotUsername}?start=${token}`;
}

/**
 * Finds a live link record from either credential.
 *
 * `text` is whatever the user sent the bot: "/start <token>", a bare token, or a
 * typed pairing code in any casing/spacing.
 */
export async function findLinkByMessage(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return null;

  const withoutCommand = trimmed.replace(/^\/start(?:@\S+)?\s*/i, "").trim();
  const candidate = withoutCommand || trimmed;
  const now = new Date();

  const byToken = await TelegramLinkToken.findOne({
    token: candidate,
    usedAt: null,
    expiresAt: { $gt: now },
  });
  if (byToken) return byToken;

  const normalized = normalizeCode(candidate);
  if (normalized.length !== CODE_LENGTH) return null;

  // Stored with the hyphen; compare against the normalized form.
  return TelegramLinkToken.findOne({
    code: `${normalized.slice(0, 4)}-${normalized.slice(4)}`,
    usedAt: null,
    expiresAt: { $gt: now },
  });
}

/**
 * Binds a chat to the account that requested the link.
 *
 * The token is consumed atomically, so two clients racing the same code (deep link
 * tapped and code typed) can only link once.
 */
export async function consumeLinkToken(link, chatId) {
  const claimed = await TelegramLinkToken.findOneAndUpdate(
    { _id: link._id, usedAt: null },
    { usedAt: new Date() },
    { new: true }
  );

  if (!claimed) return { ok: false, reason: "already-used" };

  const user = await User.findById(claimed.userId);
  if (!user || !user.isActive) return { ok: false, reason: "user-unavailable" };

  // One Telegram account cannot feed two app accounts: release the old binding.
  await User.updateMany(
    { _id: { $ne: user._id }, telegramId: String(chatId) },
    { $set: { telegramId: null } }
  );

  user.telegramId = String(chatId);
  await user.save();

  return { ok: true, user };
}

export async function unlinkTelegram(user) {
  user.telegramId = null;
  await user.save();
  await TelegramLinkToken.deleteMany({ userId: user._id });

  return user;
}
