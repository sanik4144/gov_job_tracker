import { Job } from "../models/Job.js";
import { Keyword } from "../models/Keyword.js";
import User from "../models/User.js";
import { fetchJobs } from "./scraper.js";
import { sendTelegramMessage } from "./telegram.js";

function escapeHtml(value = "") {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export async function getActiveKeywords() {
  const keywords = await Keyword.find({ active: true, userId: { $ne: null } }).sort({ value: 1 }).lean();
  return [...new Set(keywords.map((keyword) => keyword.value))];
}

export async function getUserKeywords(userId) {
  const keywords = await Keyword.find({ active: true, userId }).sort({ value: 1 }).lean();
  return [...new Set(keywords.map((keyword) => keyword.value))];
}

function getLocalScheduleParts(date, timezone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const dayByName = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    time: `${values.hour}:${values.minute}`,
    dayOfWeek: dayByName[values.weekday],
  };
}

function alreadyCheckedThisMinute(user, now) {
  if (!user.lastNotificationCheckAt) return false;

  const lastRun = new Date(user.lastNotificationCheckAt);
  return Math.floor(lastRun.getTime() / 60000) === Math.floor(now.getTime() / 60000);
}

function isUserDueForNotification(user, now, timezone) {
  const notificationsEnabled = user.notificationsEnabled ?? true;
  const notificationFrequency = user.notificationFrequency || "daily";
  const notificationTime = user.notificationTime || "19:00";
  const notificationDayOfWeek = user.notificationDayOfWeek ?? 0;

  if (!notificationsEnabled || !user.telegramId) return false;
  if (alreadyCheckedThisMinute(user, now)) return false;

  const schedule = getLocalScheduleParts(now, timezone);
  if (schedule.time !== notificationTime) return false;

  if (notificationFrequency === "weekly") {
    return schedule.dayOfWeek === notificationDayOfWeek;
  }

  return true;
}

export async function runDueUserNotificationChecks({ now = new Date(), timezone } = {}) {
  const users = await User.find({
    isActive: true,
    notificationsEnabled: { $ne: false },
    telegramId: { $nin: [null, ""] },
  });
  const dueUsers = users.filter((user) => isUserDueForNotification(user, now, timezone));
  const results = [];

  for (const user of dueUsers) {
    try {
      const keywords = await getUserKeywords(user._id);
      const result = await runDailyJobCheck({
        notify: true,
        keywords,
        notifyUserId: user._id,
      });
      user.lastNotificationCheckAt = now;
      await user.save();
      results.push({ userId: user._id, ok: true, result });
    } catch (error) {
      results.push({ userId: user._id, ok: false, error: error.message });
      console.error("Scheduled user notification failed:", {
        userId: user._id,
        message: error.message,
      });
    }
  }

  return {
    checkedAt: now.toISOString(),
    due: dueUsers.length,
    results,
  };
}

async function getUserNotificationProfiles(userId = null) {
  const keywordFilter = { active: true, userId: { $ne: null } };
  if (userId) {
    keywordFilter.userId = userId;
  }

  const keywords = await Keyword.find(keywordFilter).lean();
  const users = await User.find({
    _id: { $in: keywords.map((keyword) => keyword.userId) },
    telegramId: { $nin: [null, ""] },
    isActive: true,
  }).lean();
  const usersById = new Map(users.map((user) => [user._id.toString(), user]));
  const profilesByUserId = new Map();

  for (const keyword of keywords) {
    const user = usersById.get(keyword.userId.toString());
    if (!user) continue;

    const userId = user._id.toString();
    const profile = profilesByUserId.get(userId) || {
      user,
      keywords: [],
    };

    profile.keywords.push(keyword.value);
    profilesByUserId.set(userId, profile);
  }

  return [...profilesByUserId.values()].map((profile) => ({
    ...profile,
    keywords: [...new Set(profile.keywords)],
  }));
}

function formatGroupedDigest(newJobs, keywords) {
  const maxLength = 3800;
  const lines = [
    "<b>Government Job Tracker</b>",
    "",
    `<b>New jobs:</b> ${newJobs.length}`,
  ];

  if (newJobs.length === 0) {
    lines.push("", `No new jobs found for: ${escapeHtml(keywords.join(", "))}`);
    return lines.join("\n");
  }

  for (const keyword of keywords) {
    const keywordJobs = newJobs.filter((job) => job.keywords?.includes(keyword));
    if (keywordJobs.length === 0) continue;

    lines.push("", `<b>${escapeHtml(keyword)}</b> (${keywordJobs.length})`);

    for (const [index, job] of keywordJobs.entries()) {
      const jobLines = [
        `${index + 1}. ${escapeHtml(job.title)}`,
        job.deadline ? `   Deadline: ${escapeHtml(job.deadline)}` : "",
        job.detailUrl ? `   ${escapeHtml(job.detailUrl)}` : "",
      ].filter(Boolean);
      const nextText = [...lines, ...jobLines].join("\n");

      if (nextText.length > maxLength) {
        lines.push(`...and ${keywordJobs.length - index} more jobs.`);
        break;
      }

      lines.push(...jobLines, "");
    }
  }

  return lines.join("\n");
}

export async function scrapeAndSaveJobs(keywords) {
  const scrapedJobs = await fetchJobs(keywords);
  const newJobs = [];

  for (const scrapedJob of scrapedJobs) {
    const existing = await Job.findOne({ externalId: scrapedJob.externalId });

    if (existing) {
      existing.lastSeenAt = new Date();
      existing.title = scrapedJob.title;
      existing.organization = scrapedJob.organization;
      existing.deadline = scrapedJob.deadline;
      existing.detailUrl = scrapedJob.detailUrl;
      existing.applicationSite = scrapedJob.applicationSite;
      existing.advertisementFile = scrapedJob.advertisementFile;
      existing.advertisementUrl = scrapedJob.advertisementUrl;
      existing.sourceUrl = scrapedJob.sourceUrl;
      existing.rawText = scrapedJob.rawText;
      existing.keywords = [...new Set([...(existing.keywords || []), ...scrapedJob.keywords])];
      await existing.save();
      continue;
    }

    const created = await Job.create(scrapedJob);
    newJobs.push(created);
  }

  return {
    found: scrapedJobs.length,
    new: newJobs.length,
    jobs: newJobs,
  };
}

export async function runDailyJobCheck({
  notify = true,
  keywords: providedKeywords = null,
  notifyUserId = null,
} = {}) {
  const keywords = providedKeywords ? [...new Set(providedKeywords)] : await getActiveKeywords();

  if (keywords.length === 0) {
    return {
      checkedAt: new Date().toISOString(),
      keywords,
      found: 0,
      new: 0,
      notificationError: null,
      jobs: [],
    };
  }

  const scrapeResult = await scrapeAndSaveJobs(keywords);
  const newJobs = scrapeResult.jobs;
  const notificationErrors = [];

  if (notify) {
    if (newJobs.length > 0) {
      const notifiedAt = new Date();
      for (const job of newJobs) {
        job.notifiedAt = notifiedAt;
        await job.save();
      }
    }

    const notificationProfiles = await getUserNotificationProfiles(notifyUserId);

    for (const profile of notificationProfiles) {
      const userJobs = newJobs.filter((job) =>
        job.keywords?.some((keyword) => profile.keywords.includes(keyword))
      );

      try {
        await sendTelegramMessage(
          formatGroupedDigest(userJobs, profile.keywords),
          profile.user.telegramId
        );
      } catch (error) {
        const message = error.response?.data?.description || error.message;
        notificationErrors.push({
          userId: profile.user._id,
          chatId: profile.user.telegramId,
          message,
        });
        console.error("Telegram notification failed:", message);
      }
    }
  }

  return {
    checkedAt: new Date().toISOString(),
    keywords,
    found: scrapeResult.found,
    new: scrapeResult.new,
    notificationError: notificationErrors[0]?.message || null,
    notificationErrors,
    jobs: newJobs,
  };
}
