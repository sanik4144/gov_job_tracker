import { env } from "../config/env.js";
import { FREE_PLAN_KEY, PLANS, isUnlimited } from "../config/plans.js";

const DAY_MS = 24 * 60 * 60 * 1000;

// Statuses that can still carry a paid plan. `canceled` is an explicit revocation —
// a rejected payment, or an admin switching someone off — so it gets no grace.
const LIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

// The plan the user owns outright, ignoring any pending-payment hold.
function resolveOwnedPlanKey(user, now) {
  const storedKey = user?.plan;
  const plan = storedKey ? PLANS[storedKey] : null;

  // Unknown or zero-priced keys collapse to free. `team` is still in the User enum
  // but has no catalog entry, so it lands here instead of inheriting someone
  // else's limits.
  if (!plan || plan.priceBdt === 0) return FREE_PLAN_KEY;
  if (!LIVE_STATUSES.has(user.subscriptionStatus)) return FREE_PLAN_KEY;

  // An open-ended trial is intentional; a paid plan with no end date is a data
  // error, and must not hand out access forever.
  if (!user.subscriptionEndsAt) {
    return user.subscriptionStatus === "trialing" ? storedKey : FREE_PLAN_KEY;
  }

  const expiresAt = new Date(user.subscriptionEndsAt).getTime();
  if (Number.isNaN(expiresAt)) return FREE_PLAN_KEY;

  // Reading the clock rather than trusting the stored status is what makes a
  // stalled expiry sweep harmless: nobody keeps Pro just because a job did not run.
  return now.getTime() < expiresAt + env.subscriptionGraceDays * DAY_MS
    ? storedKey
    : FREE_PLAN_KEY;
}

/**
 * A plan held open by a submitted-but-unverified payment.
 *
 * Only ever set for users who have paid before, so it covers renewal lag without
 * handing free days to a made-up transaction ID.
 */
function resolveHeldPlanKey(user, now) {
  const heldKey = user?.subscriptionHoldPlan;
  const plan = heldKey ? PLANS[heldKey] : null;
  if (!plan || plan.priceBdt === 0 || !user.subscriptionHoldUntil) return FREE_PLAN_KEY;

  const until = new Date(user.subscriptionHoldUntil).getTime();
  if (Number.isNaN(until)) return FREE_PLAN_KEY;

  return now.getTime() < until ? heldKey : FREE_PLAN_KEY;
}

/**
 * The plan a user is actually entitled to right now.
 *
 * This is the ONLY function in the codebase that reads `user.plan`. Everything else
 * asks for limits and features through the helpers below, which is what stops plan
 * checks from scattering into controllers and drifting apart.
 */
export function resolvePlanKey(user, now = new Date()) {
  const owned = resolveOwnedPlanKey(user, now);

  return owned === FREE_PLAN_KEY ? resolveHeldPlanKey(user, now) : owned;
}

export function getPlan(user, now = new Date()) {
  return PLANS[resolvePlanKey(user, now)];
}

export function getLimits(user, now = new Date()) {
  return getPlan(user, now).limits;
}

export function getLimit(user, name, now = new Date()) {
  return getLimits(user, now)[name];
}

export function can(user, feature, now = new Date()) {
  return Boolean(getPlan(user, now).features[feature]);
}

/**
 * Whether one more of `name` fits inside the plan. `currentCount` is what the caller
 * already has, so this answers "may I add one?" rather than "am I over?".
 */
export function isWithinLimit(user, name, currentCount, now = new Date()) {
  const limit = getLimit(user, name, now);

  return isUnlimited(limit) || currentCount < limit;
}

/**
 * The entitlement payload sent to the frontend.
 *
 * Derived on every read and never stored, so a subscription that lapsed a minute ago
 * is reflected immediately without waiting for any sweep to run.
 */
export function getEntitlements(user, now = new Date()) {
  const planKey = resolvePlanKey(user, now);
  const plan = PLANS[planKey];
  const expiresAt = user?.subscriptionEndsAt ? new Date(user.subscriptionEndsAt) : null;
  const hasExpiry = Boolean(expiresAt) && !Number.isNaN(expiresAt.getTime());

  return {
    plan: planKey,
    label: plan.label,
    isPaid: plan.priceBdt > 0,
    // What the record says, which diverges from `plan` once a subscription lapses.
    // The UI reads the gap to say "your Pro plan expired" instead of a bare "Free".
    storedPlan: user?.plan || FREE_PLAN_KEY,
    status: user?.subscriptionStatus || FREE_PLAN_KEY,
    expiresAt: hasExpiry ? expiresAt.toISOString() : null,
    daysRemaining: hasExpiry
      ? Math.ceil((expiresAt.getTime() - now.getTime()) / DAY_MS)
      : null,
    // Past the end date but still working, on borrowed time.
    inGrace: planKey !== FREE_PLAN_KEY && hasExpiry && expiresAt.getTime() <= now.getTime(),
    // Running on a submitted payment that an admin has not verified yet.
    onHold:
      planKey !== FREE_PLAN_KEY && resolveOwnedPlanKey(user, now) === FREE_PLAN_KEY,
    limits: plan.limits,
    features: plan.features,
  };
}
