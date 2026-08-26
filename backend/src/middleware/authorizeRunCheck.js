import { env } from "../config/env.js";
import { authenticate } from "./auth.js";

export function authorizeRunCheck(req, res, next) {
  const cronSecret = req.header("x-cron-secret");

  if (cronSecret) {
    if (env.cronSecret && cronSecret === env.cronSecret) {
      return next();
    }

    return res.status(401).json({ error: "Unauthorized" });
  }

  return authenticate(req, res, next);
}
