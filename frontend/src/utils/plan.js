/**
 * Frontend view of the entitlements the backend sends inside the user payload.
 *
 * These helpers only read what the server resolved — they never decide a limit
 * themselves. The backend catalog stays the single source of truth, so nothing here
 * has to be kept in sync when a price or a limit changes.
 */

// Used until /me answers. Deliberately denies everything rather than mirroring the
// free plan's real values: a slow load must never render as if the viewer had more
// than they do, and copying the catalog here is exactly the drift we are avoiding.
export const PENDING_ENTITLEMENTS = {
  plan: "free",
  label: "Free",
  isPaid: false,
  storedPlan: "free",
  status: "free",
  expiresAt: null,
  daysRemaining: null,
  inGrace: false,
  limits: {
    keywords: 0,
    manualScansPerDay: 0,
    reminderStages: [],
    notificationTime: null,
    notificationFrequencies: ["daily"],
  },
  features: {
    customNotificationTime: false,
    weeklyDigest: false,
  },
  onHold: false,
  inGrace: false,
};

/**
 * `isResolved` tells the UI whether these are real limits or the placeholder. It
 * matters because the placeholder denies everything: without the flag, a control
 * would flash disabled on every load before /me answers.
 */
export function resolveEntitlements(user) {
  if (!user?.entitlements) return { ...PENDING_ENTITLEMENTS, isResolved: false };

  return { ...user.entitlements, isResolved: true };
}

// Mirrors the backend's UNLIMITED sentinel, which crosses the wire as null.
export function isUnlimited(limit) {
  return limit === null || limit === undefined;
}

export function describeLimit(limit) {
  return isUnlimited(limit) ? "Unlimited" : String(limit);
}

/**
 * Renders a reminder ladder as prose, e.g. [3, 1, 0] -> "3 days before, 1 day
 * before, and on the last day". Driven entirely by what the server sent, so the
 * copy cannot promise a rung the plan does not deliver.
 */
export function describeReminderStages(stages = []) {
  if (stages.length === 0) return "No deadline reminders";

  const parts = [...stages]
    .sort((a, b) => b - a)
    .map((stage) => {
      if (stage === 0) return "on the last day";
      return `${stage} day${stage === 1 ? "" : "s"} before`;
    });

  if (parts.length === 1) return parts[0];

  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}
