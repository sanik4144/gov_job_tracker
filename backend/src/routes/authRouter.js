import express from "express";
import {
  disconnectTelegram,
  getCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
  startTelegramLink,
  updateProfile,
} from "../controllers/authController.js";
import { authenticate } from "../middleware/auth.js";

const authRouter = express.Router();

// Registration route
authRouter.post("/register", registerUser);
authRouter.post("/login", loginUser);
authRouter.get("/me", authenticate, getCurrentUser);
authRouter.patch("/profile", authenticate, updateProfile);
authRouter.post("/logout", authenticate, logoutUser);
authRouter.post("/telegram/link", authenticate, startTelegramLink);
authRouter.delete("/telegram/link", authenticate, disconnectTelegram);

export default authRouter;
