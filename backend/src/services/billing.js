import { env } from "../config/env.js";
import { PLANS } from "../config/plans.js";
import { Payment } from "../models/Payment.js";
import User from "../models/User.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export class BillingError extends Error {
  constructor(message, status = 400, code = "BILLING_ERROR") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function normalizeRef(value) {
  return String(value || "")
    .replace(/\s+/g, "")
    .toUpperCase();
}

/**
 * Extends a subscription rather than replacing it.
 *
 * `max(now, currentEnd)` is the whole recurring model: paying early stacks the new
 * period on top of what is left, so nobody loses days by renewing before expiry, and
 * paying late starts from today rather than back-dating into a gap the user did not
 * have.
 */
export function computeNextPeriodEnd(currentEndsAt, periodDays, now = new Date()) {
  const current = currentEndsAt ? new Date(currentEndsAt).getTime() : 0;
  const base = Number.isNaN(current) ? now.getTime() : Math.max(now.getTime(), current);

  return new Date(base + periodDays * DAY_MS);
}

/**
 * Records a payment the user says they have made. Nothing is granted here — an
 * admin still has to verify it against the bKash statement.
 */
export async function submitManualPayment(user, { providerRef, senderNumber, planKey = "pro" }) {
  const plan = PLANS[planKey];
  if (!plan || plan.priceBdt <= 0) {
    throw new BillingError("That plan cannot be purchased", 400, "UNKNOWN_PLAN");
  }

  const normalizedRef = normalizeRef(providerRef);
  if (normalizedRef.length < 4) {
    throw new BillingError("Enter the transaction ID from your bKash confirmation", 400, "INVALID_REF");
  }

  const provider = "manual-bkash";

  try {
    const payment = await Payment.create({
      userId: user._id,
      plan: planKey,
      provider,
      providerRef: String(providerRef).trim(),
      normalizedRef,
      senderNumber: String(senderNumber || "").trim(),
      amountBdt: plan.priceBdt,
      status: "pending",
    });

    await applyPendingHold(user, planKey);

    return payment;
  } catch (error) {
    if (error.code === 11000) {
      throw new BillingError(
        "That transaction ID has already been submitted",
        409,
        "DUPLICATE_REF"
      );
    }

    throw error;
  }
}

/**
 * Keeps an established subscriber on their plan while an admin verifies a renewal.
 *
 * Deliberately limited to users with a previously approved payment. The hold is
 * there to stop a renewing customer being cut off by verification lag; granting it
 * on a first submission would hand free days to anyone who invents a transaction ID.
 */
async function applyPendingHold(user, planKey) {
  const hasPaidBefore = await Payment.exists({
    userId: user._id,
    status: "approved",
  });

  if (!hasPaidBefore) return;

  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        subscriptionHoldPlan: planKey,
        subscriptionHoldUntil: new Date(Date.now() + env.paymentHoldDays * DAY_MS),
      },
    }
  );
}

async function clearPendingHold(userId) {
  await User.updateOne(
    { _id: userId },
    { $set: { subscriptionHoldPlan: null, subscriptionHoldUntil: null } }
  );
}

/**
 * Approves a payment and extends the subscription it bought.
 *
 * Guarded on `status: "pending"` inside the update itself, so a double-clicked
 * Approve cannot grant two periods.
 */
export async function approvePayment(paymentId, adminUser, { now = new Date(), note = "" } = {}) {
  const payment = await Payment.findOneAndUpdate(
    { _id: paymentId, status: "pending" },
    {
      $set: {
        status: "approved",
        reviewedBy: adminUser?._id || null,
        reviewedAt: now,
        reviewNote: note,
      },
    },
    { new: true }
  );

  if (!payment) {
    throw new BillingError("That payment is not awaiting review", 409, "NOT_PENDING");
  }

  const plan = PLANS[payment.plan];
  if (!plan) {
    throw new BillingError("That payment names an unknown plan", 400, "UNKNOWN_PLAN");
  }

  const user = await User.findById(payment.userId);
  if (!user) {
    throw new BillingError("That payment has no user", 404, "NO_USER");
  }

  const periodEnd = computeNextPeriodEnd(user.subscriptionEndsAt, plan.periodDays, now);

  user.plan = payment.plan;
  user.subscriptionStatus = "active";
  user.subscriptionEndsAt = periodEnd;
  // The real period supersedes any hold that was covering the wait.
  user.subscriptionHoldPlan = null;
  user.subscriptionHoldUntil = null;
  await user.save();

  payment.periodStart = now;
  payment.periodEnd = periodEnd;
  payment.periodDays = plan.periodDays;
  await payment.save();

  return { payment, user };
}

export async function rejectPayment(paymentId, adminUser, { now = new Date(), note = "" } = {}) {
  const payment = await Payment.findOneAndUpdate(
    { _id: paymentId, status: "pending" },
    {
      $set: {
        status: "rejected",
        reviewedBy: adminUser?._id || null,
        reviewedAt: now,
        reviewNote: note,
      },
    },
    { new: true }
  );

  if (!payment) {
    throw new BillingError("That payment is not awaiting review", 409, "NOT_PENDING");
  }

  // A rejected submission stops holding the plan open immediately.
  await clearPendingHold(payment.userId);

  return payment;
}

/**
 * An admin granting time directly — a comp, an apology, a test account.
 *
 * Goes through the same ledger and the same extension maths as a real payment, so
 * the record of why someone has access is never incomplete.
 */
export async function grantSubscription(user, adminUser, { planKey = "pro", days, now = new Date(), note = "" } = {}) {
  const plan = PLANS[planKey];
  if (!plan || plan.priceBdt <= 0) {
    throw new BillingError("That plan cannot be granted", 400, "UNKNOWN_PLAN");
  }

  const periodDays = Number(days) > 0 ? Number(days) : plan.periodDays;
  const periodEnd = computeNextPeriodEnd(user.subscriptionEndsAt, periodDays, now);
  const payment = await Payment.create({
    userId: user._id,
    plan: planKey,
    provider: "manual-admin",
    providerRef: `ADMIN-${now.getTime()}-${String(user._id).slice(-6)}`,
    normalizedRef: `ADMIN-${now.getTime()}-${String(user._id).slice(-6)}`.toUpperCase(),
    amountBdt: 0,
    status: "approved",
    periodStart: now,
    periodEnd,
    periodDays,
    reviewedBy: adminUser?._id || null,
    reviewedAt: now,
    reviewNote: note || "Granted by admin",
  });

  user.plan = planKey;
  user.subscriptionStatus = "active";
  user.subscriptionEndsAt = periodEnd;
  user.subscriptionHoldPlan = null;
  user.subscriptionHoldUntil = null;
  await user.save();

  return { payment, user };
}

/**
 * Flips records whose grace window has closed.
 *
 * Purely cosmetic for access control — entitlements already resolve from the date,
 * so a run that never happens costs nobody anything. It exists to keep the admin
 * view and the billing reminders honest.
 */
export async function expireLapsedSubscriptions(now = new Date()) {
  const cutoff = new Date(now.getTime() - env.subscriptionGraceDays * DAY_MS);
  const result = await User.updateMany(
    {
      subscriptionStatus: { $in: ["active", "trialing", "past_due"] },
      subscriptionEndsAt: { $ne: null, $lt: cutoff },
    },
    { $set: { subscriptionStatus: "canceled" } }
  );

  return { expired: result.modifiedCount || 0, checkedAt: now.toISOString() };
}
