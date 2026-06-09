import { Job } from "../models/Job.js";
import { fetchJobs } from "./scraper.js";
import { sendTelegramMessage } from "./telegram.js";

function escapeHtml(value = "") {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function formatJobMessage(job) {
  const lines = [
    "<b>New government job found</b>",
    "",
    `<b>Post:</b> ${escapeHtml(job.title)}`,
  ];

  if (job.organization) lines.push(`<b>Organization:</b> ${escapeHtml(job.organization)}`);
  if (job.deadline) lines.push(`<b>Deadline:</b> ${escapeHtml(job.deadline)}`);
  if (job.detailUrl) lines.push(`<b>Details:</b> ${escapeHtml(job.detailUrl)}`);

  return lines.join("\n");
}

export async function runDailyJobCheck({ notify = true } = {}) {
  const scrapedJobs = await fetchJobs();
  const newJobs = [];

  for (const scrapedJob of scrapedJobs) {
    const existing = await Job.findOne({ externalId: scrapedJob.externalId });

    if (existing) {
      existing.lastSeenAt = new Date();
      await existing.save();
      continue;
    }

    const created = await Job.create(scrapedJob);
    newJobs.push(created);
  }

  if (notify) {
    for (const job of newJobs) {
      await sendTelegramMessage(formatJobMessage(job));
      job.notifiedAt = new Date();
      await job.save();
    }

    if (newJobs.length === 0) {
      await sendTelegramMessage("No new Assistant Programmer jobs found today.");
    }
  }

  return {
    checkedAt: new Date().toISOString(),
    found: scrapedJobs.length,
    new: newJobs.length,
    jobs: newJobs,
  };
}
