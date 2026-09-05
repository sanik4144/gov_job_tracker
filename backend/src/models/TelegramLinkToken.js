import mongoose from "mongoose";

/**
 * A pending "Connect Telegram" request.
 *
 * Carries two credentials for the same link, because no single delivery route
 * reaches every client:
 *   - `token`: 43-char base64url, rides in the t.me deep link (?start=<token>).
 *   - `code` : short, unambiguous, typed by hand when the deep link cannot work
 *              (Telegram Web, Flatpak installs, or a laptop whose owner has
 *              Telegram only on their phone).
 *
 * Single-use and short-lived: consumed on first match, and swept by the TTL index.
 */
const telegramLinkTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    usedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Mongo drops the document once expiresAt passes, so stale codes cannot be replayed.
telegramLinkTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const TelegramLinkToken = mongoose.model("TelegramLinkToken", telegramLinkTokenSchema);
