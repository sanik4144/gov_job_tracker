import bcrypt from "bcrypt";
import { requireEnv } from "../config/env.js";
import { connectDb } from "../db.js";
import User from "../models/User.js";

const ADMIN_EMAIL = "admin@dailygovjobbd.com";
const ADMIN_PASSWORD = "12345678";

requireEnv();

try {
  await connectDb();

  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const admin = await User.findOneAndUpdate(
    { email: ADMIN_EMAIL },
    {
      name: "Daily Gov Job Admin",
      email: ADMIN_EMAIL,
      password: hashedPassword,
      role: "admin",
      isActive: true,
      notificationsEnabled: true,
      notificationFrequency: "daily",
      notificationTime: "19:00",
      notificationDayOfWeek: 0,
      plan: "free",
      subscriptionStatus: "free",
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  console.log(`Admin user ready: ${admin.email}`);
  process.exit(0);
} catch (error) {
  console.error("Admin seed failed:", error);
  process.exit(1);
}
