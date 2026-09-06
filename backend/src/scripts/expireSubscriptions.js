import mongoose from "mongoose";
import { connectDb } from "../db.js";
import { expireLapsedSubscriptions } from "../services/billing.js";

/**
 * Marks subscriptions whose grace window has closed as canceled.
 *
 * Idempotent, and safe to run from an external scheduler on deployments where the
 * in-process cron is disabled. Access control does not depend on it — entitlements
 * resolve from the date — so this only keeps stored statuses honest.
 */
async function main() {
  await connectDb();
  const result = await expireLapsedSubscriptions();
  console.log(`Expired ${result.expired} subscription(s) at ${result.checkedAt}`);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("Expiry sweep failed:", error);
  process.exit(1);
});
