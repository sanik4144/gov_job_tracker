import { env } from "../config/env.js";
import { ensureDbReady } from "../db.js";
import { Job } from "../models/Job.js";
import { Keyword } from "../models/Keyword.js";
import User from "../models/User.js";
import { evaluateNotificationDue } from "./notificationSchedule.js";
import { fetchJobs } from "./scraper.js";
import { describeTelegramError, sendTelegramMessage } from "./telegram.js";

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

export async function runDueUserNotificationChecks({ now = new Date(), timezone } = {}) {
  await ensureDbReady();

  const users = await User.find({
    isActive: true,
    notificationsEnabled: { $ne: false },
    telegramId: { $nin: [null, ""] },
  });

  const dueUsers = [];
  for (const user of users) {
    const verdict = evaluateNotificationDue(user, now, timezone, {
      catchUpMinutes: env.notificationCatchUpMinutes,
      retryMinutes: env.notificationRetryMinutes,
    });

    if (verdict.due) dueUsers.push({ user, verdict });
  }

  const results = [];

  for (const { user, verdict } of dueUsers) {
    // Stamp the attempt before the work starts so a crash mid-run cannot turn into
    // a retry storm, and so overlapping ticks never double-send the same slot.
    // Success markers are written only after the digest actually goes out.
    user.lastNotificationAttemptAt = now;
    await user.save();

    try {
      const keywords = await getUserKeywords(user._id);
      const result = await runDailyJobCheck({
        notify: true,
        keywords,
        notifyUserId: user._id,
      });

      if (result.notificationErrors.length > 0) {
        throw new Error(result.notificationErrors[0].message);
      }

      user.lastNotifiedSlotAt = verdict.slot;
      user.lastNotificationCheckAt = now;
      await user.save();

      console.log("Scheduled notification sent", {
        userId: String(user._id),
        slot: verdict.slot.toISOString(),
        trigger: verdict.reason,
        new: result.new,
      });
      results.push({ userId: user._id, ok: true, slot: verdict.slot, result });
    } catch (error) {
      // The slot stays undelivered, so it is retried on a later tick until the
      // catch-up window closes.
      results.push({ userId: user._id, ok: false, slot: verdict.slot, error: error.message });
      console.error("Scheduled user notification failed:", {
        userId: String(user._id),
        slot: verdict.slot.toISOString(),
        message: error.message,
      });
    }
  }

  return {
    checkedAt: now.toISOString(),
    due: dueUsers.length,
    sent: results.filter((entry) => entry.ok).length,
    failed: results.filter((entry) => !entry.ok).length,
    results,
  };
}

async function getUserNotificationProfiles(userId = null) {
  // Targeted run (the Run Scan button, or a scheduled slot): the recipient is the
  // user themself, not whoever happens to own keyword rows. This is what guarantees
  // a digest goes out even when the user has no keywords and no new jobs.
  if (userId) {
    const user = await User.findOne({
      _id: userId,
      isActive: true,
      telegramId: { $nin: [null, ""] },
    }).lean();

    if (!user) return [];

    return [{ user, keywords: await getUserKeywords(userId) }];
  }

  const keywords = await Keyword.find({ active: true, userId: { $ne: null } }).lean();
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

    const key = user._id.toString();
    const profile = profilesByUserId.get(key) || { user, keywords: [] };

    profile.keywords.push(keyword.value);
    profilesByUserId.set(key, profile);
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

  if (keywords.length === 0) {
    lines.push(
      "",
      "You have no active keywords yet.",
      "Add keywords in the dashboard to start receiving job matches."
    );
    return lines.join("\n");
  }

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

  // A user with no keywords still gets their scheduled digest — it just reports that
  // there is nothing to match on yet — so this only skips the scrape, not the notify.
  const scrapeResult =
    keywords.length === 0 ? { found: 0, new: 0, jobs: [] } : await scrapeAndSaveJobs(keywords);
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
        // Never let this collapse to an empty string: it used to fall through the
        // `|| null` below and report a clean run for a digest that never sent.
        const message = describeTelegramError(error);
        notificationErrors.push({
          userId: profile.user._id,
          chatId: profile.user.telegramId,
          message,
        });
        console.error("Telegram notification failed:", {
          userId: String(profile.user._id),
          chatId: profile.user.telegramId,
          message,
        });
      }
    }
  }

  return {
    checkedAt: new Date().toISOString(),
    keywords,
    found: scrapeResult.found,
    new: scrapeResult.new,
    notificationError: notificationErrors[0]?.message ?? null,
    notificationErrors,
    jobs: newJobs,
  };
}
