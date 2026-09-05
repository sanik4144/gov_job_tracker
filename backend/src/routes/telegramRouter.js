import express from "express";
import { handleTelegramWebhook } from "../controllers/telegramController.js";
import {
  rateLimitTelegramWebhook,
  verifyTelegramWebhook,
} from "../middleware/verifyTelegramWebhook.js";

const telegramRouter = express.Router();

telegramRouter.post(
  "/webhook",
  rateLimitTelegramWebhook(),
  verifyTelegramWebhook,
  handleTelegramWebhook
);

export default telegramRouter;
