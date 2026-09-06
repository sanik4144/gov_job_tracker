const MEDIA_BASE_URL = "https://alljobs.teletalk.com.bd/media";

function getTodayUtcDateOnly() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function getDeadlineMeta(deadline) {
  if (!deadline) {
    return {
      deadlineTime: Number.MAX_SAFE_INTEGER,
      isExpired: false,
      isDueSoon: false,
      daysUntilDeadline: null,
    };
  }

  const parsed = new Date(`${deadline}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return {
      deadlineTime: Number.MAX_SAFE_INTEGER,
      isExpired: false,
      isDueSoon: false,
      daysUntilDeadline: null,
    };
  }

  const diffMs = parsed.getTime() - getTodayUtcDateOnly().getTime();
  const daysUntilDeadline = Math.ceil(diffMs / 86400000);

  return {
    deadlineTime: parsed.getTime(),
    isExpired: daysUntilDeadline < 0,
    isDueSoon: daysUntilDeadline >= 0 && daysUntilDeadline <= 2,
    daysUntilDeadline,
  };
}

function toDateOnlyString(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Inclusive [from, to] YYYY-MM-DD range covering today through `days` days ahead.
 *
 * Deadlines are stored as YYYY-MM-DD strings, so a lexicographic range query on
 * that field is both correct and index-friendly — and empty deadlines sort below
 * `from`, so they drop out for free. Anchored to the same UTC day as
 * getDeadlineMeta so the badge in the UI and the reminder never disagree.
 */
export function getDeadlineWindow(days) {
  const today = getTodayUtcDateOnly();

  return {
    from: toDateOnlyString(today),
    to: toDateOnlyString(new Date(today.getTime() + days * 86400000)),
  };
}

export function buildAdvertisementUrl(job) {
  if (job.advertisementFile) {
    try {
      return new URL(job.advertisementFile, `${MEDIA_BASE_URL}/`).toString();
    } catch {
      return job.advertisementUrl || "";
    }
  }

  return job.advertisementUrl || "";
}
