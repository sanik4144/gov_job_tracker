const DAY_MS = 24 * 60 * 60 * 1000;

function getZonedParts(date, timezone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    // Intl renders midnight as "24" in some locales/engines.
    hour: Number(values.hour) % 24,
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function getZoneOffsetMs(date, timezone) {
  const parts = getZonedParts(date, timezone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );

  return asUtc - date.getTime();
}

// Turns a wall-clock time in `timezone` into the matching UTC instant.
// The second pass settles days where the offset changes (DST transitions).
export function zonedWallClockToUtc({ year, month, day, hour, minute }, timezone) {
  const naive = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let timestamp = naive - getZoneOffsetMs(new Date(naive), timezone);
  timestamp = naive - getZoneOffsetMs(new Date(timestamp), timezone);

  return new Date(timestamp);
}

function shiftCalendarDay({ year, month, day }, days) {
  const shifted = new Date(Date.UTC(year, month - 1, day) + days * DAY_MS);

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    dayOfWeek: shifted.getUTCDay(),
  };
}

function parseNotificationTime(value) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value || "").trim());
  if (!match) return { hour: 19, minute: 0 };

  return { hour: Number(match[1]), minute: Number(match[2]) };
}

export function getNotificationSettings(user) {
  return {
    enabled: user.notificationsEnabled ?? true,
    frequency: user.notificationFrequency === "weekly" ? "weekly" : "daily",
    ...parseNotificationTime(user.notificationTime),
    dayOfWeek: Number.isInteger(user.notificationDayOfWeek) ? user.notificationDayOfWeek : 0,
  };
}

/**
 * The most recent scheduled slot at or before `now`, as a UTC instant.
 * Daily walks back at most one day, weekly at most seven.
 */
export function getLastScheduledSlot(user, now, timezone) {
  const settings = getNotificationSettings(user);
  const today = getZonedParts(now, timezone);
  const maxDaysBack = settings.frequency === "weekly" ? 7 : 1;

  for (let daysBack = 0; daysBack <= maxDaysBack; daysBack += 1) {
    const candidateDay = shiftCalendarDay(today, -daysBack);

    if (settings.frequency === "weekly" && candidateDay.dayOfWeek !== settings.dayOfWeek) {
      continue;
    }

    const slot = zonedWallClockToUtc(
      { ...candidateDay, hour: settings.hour, minute: settings.minute },
      timezone
    );

    if (slot.getTime() <= now.getTime()) return slot;
  }

  return null;
}

/**
 * Decides whether a user's schedule slot is owed a delivery right now.
 *
 * A slot is owed when it has passed, has not been delivered yet, and is not older
 * than the catch-up window. Failed attempts leave the slot undelivered, so they are
 * retried on later ticks — spaced by `retryMinutes` — until the window closes.
 */
export function evaluateNotificationDue(user, now, timezone, options = {}) {
  const catchUpMinutes = options.catchUpMinutes ?? 360;
  const retryMinutes = options.retryMinutes ?? 10;
  const settings = getNotificationSettings(user);

  if (!settings.enabled) return { due: false, reason: "notifications-disabled", slot: null };
  if (!user.telegramId) return { due: false, reason: "no-telegram-id", slot: null };

  const slot = getLastScheduledSlot(user, now, timezone);
  if (!slot) return { due: false, reason: "no-slot-yet", slot: null };

  if (now.getTime() - slot.getTime() > catchUpMinutes * 60 * 1000) {
    return { due: false, reason: "slot-too-old", slot };
  }

  // Never fire a slot that predates the account or the current schedule settings.
  const baseline = [user.notificationScheduleUpdatedAt, user.createdAt]
    .filter(Boolean)
    .map((value) => new Date(value).getTime());

  if (baseline.length && slot.getTime() < Math.max(...baseline)) {
    return { due: false, reason: "slot-predates-settings", slot };
  }

  // `lastNotificationCheckAt` is the pre-existing field and is only stamped on a
  // successful delivery, so it is a safe stand-in for rows written before
  // `lastNotifiedSlotAt` existed.
  const deliveredAt = user.lastNotifiedSlotAt || user.lastNotificationCheckAt;
  const deliveredSlot = deliveredAt ? new Date(deliveredAt) : null;
  if (deliveredSlot && deliveredSlot.getTime() >= slot.getTime()) {
    return { due: false, reason: "already-delivered", slot };
  }

  const lastAttempt = user.lastNotificationAttemptAt
    ? new Date(user.lastNotificationAttemptAt)
    : null;

  if (
    lastAttempt &&
    lastAttempt.getTime() >= slot.getTime() &&
    now.getTime() - lastAttempt.getTime() < retryMinutes * 60 * 1000
  ) {
    return { due: false, reason: "retry-backoff", slot };
  }

  return { due: true, reason: lastAttempt && lastAttempt >= slot ? "retry" : "scheduled", slot };
}
