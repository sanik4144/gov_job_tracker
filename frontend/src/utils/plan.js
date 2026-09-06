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
};

export function resolveEntitlements(user) {
  return user?.entitlements || PENDING_ENTITLEMENTS;
}

// Mirrors the backend's UNLIMITED sentinel, which crosses the wire as null.
export function isUnlimited(limit) {
  return limit === null || limit === undefined;
}

export function describeLimit(limit) {
  return isUnlimited(limit) ? "Unlimited" : String(limit);
}
