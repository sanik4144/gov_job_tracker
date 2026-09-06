import { env } from "../config/env.js";
import { isUnlimited } from "../config/plans.js";
import User from "../models/User.js";
import { getLimit } from "./entitlements.js";

/**
 * The quota window's calendar day, in the app's timezone rather than UTC, so the
 * daily allowance resets at local midnight for the people using it.
 * en-CA formats as YYYY-MM-DD.
 */
export function getQuotaDay(now = new Date(), timezone = env.timezone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * Takes one manual scan from the user's daily allowance.
 *
 * Returns `{ allowed: false }` when the allowance is spent — the caller reports it
 * rather than this throwing, because "you are out of scans" is a normal answer.
 */
export async function consumeManualScan(user, now = new Date()) {
  const limit = getLimit(user, "manualScansPerDay", now);
  if (isUnlimited(limit)) {
    return { allowed: true, limit: null, used: null, remaining: null, day: null };
  }

  const day = getQuotaDay(now);

  // Roll the window first, kept separate so the increment below can stay a single
  // conditional update.
  await User.updateOne(
    { _id: user._id, manualScanDay: { $ne: day } },
    { $set: { manualScanDay: day, manualScanCount: 0 } }
  );

  // The quota lives in the filter, so two concurrent scans cannot both read the
  // same count and slip through together.
  const updated = await User.findOneAndUpdate(
    { _id: user._id, manualScanDay: day, manualScanCount: { $lt: limit } },
    { $inc: { manualScanCount: 1 } },
    { new: true }
  );

  if (!updated) {
    return { allowed: false, limit, used: limit, remaining: 0, day };
  }

  return {
    allowed: true,
    limit,
    used: updated.manualScanCount,
    remaining: Math.max(0, limit - updated.manualScanCount),
    day,
  };
}

/**
 * Hands a scan back when the run never happened.
 *
 * A transient scrape failure should not burn a free user's only scan of the day.
 * Guarded on the day so a refund arriving after midnight cannot make the new day's
 * counter negative.
 */
export async function refundManualScan(user, day) {
  if (!day) return;

  await User.updateOne(
    { _id: user._id, manualScanDay: day, manualScanCount: { $gt: 0 } },
    { $inc: { manualScanCount: -1 } }
  );
}
