import { ensureDbReady } from "../db.js";
import User from "../models/User.js";
import { sendTelegramMessage } from "../services/telegram.js";
import { consumeLinkToken, findLinkByMessage } from "../services/telegramLink.js";

// Telegram redelivers an update until it gets a 2xx, so the same update_id can
// arrive more than once. Remembering recent ids keeps a retry from double-linking.
const seenUpdateIds = new Set();
const SEEN_LIMIT = 500;

function alreadyHandled(updateId) {
  if (updateId == null) return false;
  if (seenUpdateIds.has(updateId)) return true;

  seenUpdateIds.add(updateId);
  if (seenUpdateIds.size > SEEN_LIMIT) {
    seenUpdateIds.delete(seenUpdateIds.values().next().value);
  }

  return false;
}

const HELP_TEXT = [
  "<b>Government Job Tracker</b>",
  "",
  "To receive job alerts here, open your profile on the website,",
  "press <b>Connect Telegram</b>, and send me the code it shows you.",
].join("\n");

async function reply(chatId, text) {
  try {
    await sendTelegramMessage(text, chatId);
  } catch (error) {
    // The user still gets linked even if the confirmation fails to send.
    console.error("[telegram] Reply failed:", error.message);
  }
}

async function handleMessage(message) {
  const chatId = message.chat?.id;
  const text = (message.text || "").trim();

  // Group chats have negative ids and shared membership — never bind one to an account.
  if (!chatId || message.chat?.type !== "private" || !text) return;

  if (/^\/(stop|unlink)(@\S+)?$/i.test(text)) {
    const user = await User.findOne({ telegramId: String(chatId) });
    if (user) {
      user.telegramId = null;
      await user.save();
    }

    await reply(chatId, "Disconnected. You will no longer receive job alerts here.");
    return;
  }

  const link = await findLinkByMessage(text);

  if (link) {
    const result = await consumeLinkToken(link, chatId);

    if (result.ok) {
      console.log("[telegram] Account linked", {
        userId: String(result.user._id),
        chatId: String(chatId),
      });
      await reply(
        chatId,
        [
          "✅ <b>Connected</b>",
          "",
          `This chat now receives job alerts for ${result.user.name}.`,
          "Send /stop at any time to disconnect.",
        ].join("\n")
      );
    } else if (result.reason === "already-used") {
      await reply(chatId, "That code was already used. Generate a new one from your profile.");
    } else {
      await reply(chatId, "That account is unavailable. Please contact support.");
    }

    return;
  }

  // A bare /start with no payload: the common case for someone who found the bot
  // directly, or whose client did not forward the deep-link token.
  if (/^\/start(@\S+)?$/i.test(text)) {
    await reply(chatId, HELP_TEXT);
    return;
  }

  await reply(
    chatId,
    ["That code is not valid or has expired.", "", HELP_TEXT].join("\n")
  );
}

export async function handleTelegramWebhook(req, res) {
  const update = req.body || {};

  // Acknowledge first: anything non-2xx makes Telegram retry and back off, and the
  // work below involves network calls that can outlive the request.
  res.sendStatus(200);

  if (alreadyHandled(update.update_id)) return;

  const message = update.message || update.edited_message;
  if (!message) return;

  try {
    await ensureDbReady();
    await handleMessage(message);
  } catch (error) {
    console.error("[telegram] Failed to handle update", {
      updateId: update.update_id,
      message: error.message,
    });
  }
}
