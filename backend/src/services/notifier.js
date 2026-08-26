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
