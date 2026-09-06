import { env } from "../config/env.js";
import { ensureDbReady } from "../db.js";
import { DeadlineReminder } from "../models/DeadlineReminder.js";
import { Job } from "../models/Job.js";
import { JobNotification } from "../models/JobNotification.js";
import { Keyword } from "../models/Keyword.js";
import User from "../models/User.js";
import { getDeadlineMeta, getDeadlineWindow } from "../utils/jobView.js";
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
        closingSoon: result.closingSoon,
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

/**
 * Jobs this user's keywords match that this user has not been sent yet.
 *
 * Deliberately not "jobs inserted by this scrape": job rows are shared, so another
 * user scraping `programmer` first would otherwise leave nothing new for everyone
 * else watching `programmer`.
 */
export async function getPendingJobsForUser(userId, keywords, { lookbackDays } = {}) {
  if (!userId || keywords.length === 0) return [];

  const days = lookbackDays ?? env.notificationJobLookbackDays;
  const candidates = await Job.find({
    keywords: { $in: keywords },
    createdAt: { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
  })
    .sort({ createdAt: 1 })
    .lean();

  if (candidates.length === 0) return [];

  const alreadySent = await JobNotification.find({
    userId,
    jobId: { $in: candidates.map((job) => job._id) },
  })
    .select("jobId")
    .lean();
  const sentIds = new Set(alreadySent.map((entry) => entry.jobId.toString()));

  return candidates.filter((job) => !sentIds.has(job._id.toString()));
}

/**
 * Distinguishes "this chat is gone for good" from a transient failure. Telegram
 * answers 403 when the user blocked the bot or deleted the account, and 400
 * "chat not found" when the id no longer resolves — neither is worth retrying.
 */
function isUnreachableChatError(error) {
  const status = error?.telegramStatus ?? error?.response?.status;
  const description = String(error?.message || "").toLowerCase();

  if (status === 403) return true;

  return (
    status === 400 &&
    (description.includes("chat not found") || description.includes("user is deactivated"))
  );
}

async function recordJobsNotified(userId, jobIds) {
  if (!userId || jobIds.length === 0) return;

  try {
    await JobNotification.insertMany(
      jobIds.map((jobId) => ({ userId, jobId, notifiedAt: new Date() })),
      { ordered: false }
    );
  } catch (error) {
    // Duplicate keys just mean a concurrent run already recorded it — that is the
    // index doing its job, not a failure.
    if (error.code !== 11000 && error.writeErrors?.some((item) => item.err?.code !== 11000)) {
      throw error;
    }
  }
}

/**
 * Builds the digest and reports exactly which jobs made it into the text.
 *
 * Only the reported jobs get marked as delivered, so anything trimmed by the
 * length cap stays pending and appears in the next digest instead of being lost.
 */
function formatGroupedDigest(newJobs, keywords) {
  const maxLength = 3800;
  const includedJobIds = new Set();
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
    return { text: lines.join("\n"), jobIds: [] };
  }

  if (newJobs.length === 0) {
    lines.push("", `No new jobs found for: ${escapeHtml(keywords.join(", "))}`);
    return { text: lines.join("\n"), jobIds: [] };
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
      includedJobIds.add(String(job._id));
    }
  }

  return { text: lines.join("\n"), jobIds: [...includedJobIds] };
}

/**
 * Jobs this user is watching that close within the reminder window and that the
 * user has not applied to yet.
 *
 * Applied state is read from `user.appliedJobs` rather than `Job.applied`: job rows
 * are shared between users, so the flag on the job says nothing about this user.
 */
export async function getJobsClosingSoonForUser(user, keywords, { days } = {}) {
  const windowDays = days ?? env.deadlineReminderDays;
  if (!user?._id || keywords.length === 0 || !(windowDays >= 0)) return [];

  const { from, to } = getDeadlineWindow(windowDays);
  const candidates = await Job.find({
    keywords: { $in: keywords },
    deadline: { $gte: from, $lte: to },
  })
    .sort({ deadline: 1 })
    .lean();

  if (candidates.length === 0) return [];

  const appliedJobIds = new Set((user.appliedJobs || []).map((entry) => String(entry.job)));
  const openJobs = candidates.filter((job) => !appliedJobIds.has(String(job._id)));
  if (openJobs.length === 0) return [];

  const alreadyReminded = await DeadlineReminder.find({
    userId: user._id,
    jobId: { $in: openJobs.map((job) => job._id) },
  })
    .select("jobId deadline")
    .lean();
  const remindedKeys = new Set(
    alreadyReminded.map((entry) => `${entry.jobId}:${entry.deadline}`)
  );

  return openJobs.filter((job) => !remindedKeys.has(`${job._id}:${job.deadline}`));
}

/**
 * Builds the reminder and reports exactly which jobs made it into the text, so a
 * job trimmed by the length cap stays unreminded and reappears next run.
 */
function formatDeadlineReminder(jobs) {
  const maxLength = 3600;
  const includedJobIds = new Set();
  const lines = [
    "<b>Closing Soon</b>",
    "",
    `${jobs.length} job${jobs.length === 1 ? "" : "s"} you have not applied to yet.`,
  ];

  for (const job of jobs) {
    const { daysUntilDeadline } = getDeadlineMeta(job.deadline);
    const urgency =
      daysUntilDeadline === 0
        ? "last day"
        : `${daysUntilDeadline} day${daysUntilDeadline === 1 ? "" : "s"} left`;
    // The leading blank separates entries, so it is added after the filter rather
    // than being dropped by it.
    const jobLines = [
      "",
      ...[
        `<b>${escapeHtml(job.title)}</b>`,
        job.organization ? `   ${escapeHtml(job.organization)}` : "",
        `   Deadline: ${escapeHtml(job.deadline)} (${urgency})`,
        job.detailUrl ? `   ${escapeHtml(job.detailUrl)}` : "",
      ].filter(Boolean),
    ];

    if ([...lines, ...jobLines].join("\n").length > maxLength) {
      lines.push("", `...and ${jobs.length - includedJobIds.size} more closing soon.`);
      break;
    }

    lines.push(...jobLines);
    includedJobIds.add(String(job._id));
  }

  lines.push("", "Mark a job as applied in the dashboard to stop its reminder.");

  return {
    text: lines.join("\n"),
    jobs: jobs.filter((job) => includedJobIds.has(String(job._id))),
  };
}

async function recordDeadlineReminders(userId, jobs) {
  if (!userId || jobs.length === 0) return;

  try {
    await DeadlineReminder.insertMany(
      jobs.map((job) => ({
        userId,
        jobId: job._id,
        deadline: job.deadline,
        remindedAt: new Date(),
      })),
      { ordered: false }
    );
  } catch (error) {
    // Duplicate keys just mean a concurrent run already recorded it.
    if (error.code !== 11000 && error.writeErrors?.some((item) => item.err?.code !== 11000)) {
      throw error;
    }
  }
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
  const reminderErrors = [];
  const notifiedCounts = new Map();
  const remindedCounts = new Map();

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
      // Per-user newness: what THIS user has not received yet, regardless of who
      // scraped the job into the shared collection first.
      const userJobs = await getPendingJobsForUser(profile.user._id, profile.keywords);
      const digest = formatGroupedDigest(userJobs, profile.keywords);

      try {
        await sendTelegramMessage(digest.text, profile.user.telegramId);
        // Recorded only after the send succeeds, so a failed digest is retried
        // with the same jobs rather than silently marked delivered.
        await recordJobsNotified(profile.user._id, digest.jobIds);
        notifiedCounts.set(String(profile.user._id), digest.jobIds.length);
      } catch (error) {
        // Never let this collapse to an empty string: it used to fall through the
        // `|| null` below and report a clean run for a digest that never sent.
        const message = describeTelegramError(error);

        // A blocked or deleted chat never recovers on its own, so drop the binding
        // instead of retrying it on every scheduled run forever.
        if (isUnreachableChatError(error)) {
          await User.updateOne(
            { _id: profile.user._id },
            { $set: { telegramId: null } }
          );
          console.warn("[telegram] Cleared unreachable chat binding", {
            userId: String(profile.user._id),
            reason: message,
          });
        }

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
        // The reminder goes to the same chat, so it would fail too — and an
        // unreachable chat has just been unlinked above.
        continue;
      }

      if (profile.user.deadlineRemindersEnabled === false) continue;

      try {
        const closingJobs = await getJobsClosingSoonForUser(profile.user, profile.keywords);
        if (closingJobs.length === 0) continue;

        const reminder = formatDeadlineReminder(closingJobs);
        await sendTelegramMessage(reminder.text, profile.user.telegramId);
        // Recorded only after the send succeeds, and only for the jobs the text
        // actually listed.
        await recordDeadlineReminders(profile.user._id, reminder.jobs);
        remindedCounts.set(String(profile.user._id), reminder.jobs.length);
      } catch (error) {
        // Non-fatal on purpose. Nothing was recorded, so these jobs are retried on
        // the next run while they remain inside the window; failing the whole slot
        // would re-send the digest that already went out.
        const message = describeTelegramError(error);
        reminderErrors.push({ userId: profile.user._id, message });
        console.error("Deadline reminder failed:", {
          userId: String(profile.user._id),
          chatId: profile.user.telegramId,
          message,
        });
      }
    }
  }

  // For a targeted run, "new" means new *for that user* — otherwise the UI would
  // report 0 while the digest it just triggered listed several jobs.
  const deliveredToTarget = notifyUserId ? notifiedCounts.get(String(notifyUserId)) : null;
  const remindedToTarget = notifyUserId ? remindedCounts.get(String(notifyUserId)) : null;
  const totalReminded = [...remindedCounts.values()].reduce((total, count) => total + count, 0);

  return {
    checkedAt: new Date().toISOString(),
    keywords,
    found: scrapeResult.found,
    new: deliveredToTarget ?? scrapeResult.new,
    newlyDiscovered: scrapeResult.new,
    closingSoon: remindedToTarget ?? totalReminded,
    notificationError: notificationErrors[0]?.message ?? null,
    notificationErrors,
    reminderError: reminderErrors[0]?.message ?? null,
    reminderErrors,
    jobs: newJobs,
  };
}
