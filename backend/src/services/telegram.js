import axios from "axios";
import { env } from "../config/env.js";

export async function sendTelegramMessage(text, chatId) {
  if (!chatId) {
    throw new Error("Telegram chat ID is required");
  }

  const url = `https://api.telegram.org/bot${env.telegramBotToken}/sendMessage`;

  const response = await axios.post(url, {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: false,
  });

  return response.data;
}
