import { Job } from "../models/Job.js";
import { Keyword } from "../models/Keyword.js";
import { env } from "../config/env.js";
import { fetchJobs } from "./scraper.js";
import { sendTelegramMessage } from "./telegram.js";

function escapeHtml(value = "") {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function normalizeKeyword(value) {
  return value.trim().toLowerCase();
}

export async function ensureDefaultKeyword() {
  const value = env.jobKeyword;
  await Keyword.updateOne(
    { normalizedValue: normalizeKeyword(value) },
    {
      $setOnInsert: {
        value,
        normalizedValue: normalizeKeyword(value),
        active: true,
      },
    },
    { upsert: true }
  );
}

export async function getActiveKeywords() {
  await ensureDefaultKeyword();
  const keywords = await Keyword.find({ active: true }).sort({ value: 1 }).lean();
  return keywords.map((keyword) => keyword.value);
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

export async function runDailyJobCheck({ notify = true } = {}) {
  const keywords = await getActiveKeywords();
  const scrapedJobs = await fetchJobs(keywords);
  const newJobs = [];
  let notificationError = null;

  for (const scrapedJob of scrapedJobs) {
    const existing = await Job.findOne({ externalId: scrapedJob.externalId });

    if (existing) {
      existing.lastSeenAt = new Date();
      existing.title = scrapedJob.title;
      existing.organization = scrapedJob.organization;
      existing.deadline = scrapedJob.deadline;
      existing.detailUrl = scrapedJob.detailUrl;
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

  if (notify) {
    if (newJobs.length > 0) {
      const notifiedAt = new Date();
      for (const job of newJobs) {
        job.notifiedAt = notifiedAt;
        await job.save();
      }
    }

    try {
      await sendTelegramMessage(formatGroupedDigest(newJobs, keywords));
    } catch (error) {
      notificationError = error.response?.data?.description || error.message;
      console.error("Telegram notification failed:", notificationError);
    }
  }

  return {
    checkedAt: new Date().toISOString(),
    keywords,
    found: scrapedJobs.length,
    new: newJobs.length,
    notificationError,
    jobs: newJobs,
  };
}
