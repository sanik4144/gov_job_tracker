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
