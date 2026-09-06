/**
 * The single source of truth for what each plan allows.
 *
 * Data only: no conditionals, no reads of user state. Everything that needs to know
 * a limit goes through services/entitlements.js, so changing a price or a limit is a
 * one-line edit here and the pricing page can never drift from what is enforced.
 *
 * `null` means unlimited / unrestricted. Deliberately not Infinity — these values are
 * serialized to the frontend, and JSON.stringify turns Infinity into null anyway, so
 * null is the honest representation on both sides of the wire.
 */
export const UNLIMITED = null;

export const FREE_PLAN_KEY = "free";

function deepFreeze(value) {
  for (const key of Object.getOwnPropertyNames(value)) {
    const child = value[key];
    if (child && typeof child === "object") deepFreeze(child);
  }

  return Object.freeze(value);
}

export const PLANS = deepFreeze({
  free: {
    key: "free",
    label: "Free",
    priceBdt: 0,
    periodDays: null,
    limits: {
      keywords: 2,
      manualScansPerDay: 1,
      // Days before a deadline that an unapplied job is reminded. 0 is the last day.
      reminderStages: [0],
      // Every free digest goes out at this fixed time; null means the user picks.
      notificationTime: "21:00",
      notificationFrequencies: ["daily"],
    },
    features: {
      customNotificationTime: false,
      weeklyDigest: false,
    },
  },
  pro: {
    key: "pro",
    label: "Pro",
    priceBdt: 99,
    periodDays: 30,
    limits: {
      keywords: UNLIMITED,
      manualScansPerDay: 10,
      reminderStages: [3, 1, 0],
      notificationTime: null,
      notificationFrequencies: ["daily", "weekly"],
    },
    features: {
      customNotificationTime: true,
      weeklyDigest: true,
    },
  },
});

export function isUnlimited(limit) {
  return limit === UNLIMITED;
}
