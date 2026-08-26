import { ensureDbReady } from "../db.js";
import { Job } from "../models/Job.js";
import { getUserKeywords } from "../services/notifier.js";
import { buildAdvertisementUrl, getDeadlineMeta } from "../utils/jobView.js";

export async function listJobs(req, res, next) {
  try {
    await ensureDbReady();
    const userKeywords = await getUserKeywords(req.user._id);
    const requestedKeyword = String(req.query.keyword || "").trim();

    if (userKeywords.length === 0) {
      return res.json({ jobs: [] });
    }

    if (requestedKeyword && !userKeywords.includes(requestedKeyword)) {
      return res.json({ jobs: [] });
    }

    const filter = {
      keywords: requestedKeyword || { $in: userKeywords },
    };
    const includeExpired = req.query.includeExpired === "true";
    const resultLimit = req.query.applied === "true" ? undefined : 100;
    const appliedById = new Map(
      (req.user.appliedJobs || []).map((appliedJob) => [
        appliedJob.job.toString(),
        appliedJob.appliedAt,
      ])
    );

    const jobs = await Job.find(filter).lean();
    const visibleJobs = jobs
      .map((job) => {
        const deadlineMeta = getDeadlineMeta(job.deadline);
        const appliedAt = appliedById.get(job._id.toString()) || null;
        return {
          ...job,
          ...deadlineMeta,
          advertisementUrl: buildAdvertisementUrl(job),
          applied: Boolean(appliedAt),
          appliedAt,
        };
      })
      .filter((job) => req.query.applied !== "true" || job.applied)
      .filter((job) => includeExpired || !job.isExpired)
      .sort((a, b) => a.deadlineTime - b.deadlineTime || a.title.localeCompare(b.title))
      .slice(0, resultLimit)
      .map(({ deadlineTime, ...job }) => job);

    res.json({ jobs: visibleJobs });
  } catch (error) {
    next(error);
  }
}

export async function updateAppliedStatus(req, res, next) {
  try {
    await ensureDbReady();
    const applied = Boolean(req.body?.applied);
    const job = await Job.findById(req.params.id).lean();

    if (!job) return res.status(404).json({ error: "Job not found" });

    const userKeywords = await getUserKeywords(req.user._id);
    const isUserJob = job.keywords?.some((keyword) => userKeywords.includes(keyword));

    if (!isUserJob) {
      return res.status(404).json({ error: "Job not found" });
    }

    const existingAppliedJob = req.user.appliedJobs.find(
      (appliedJob) => appliedJob.job.toString() === req.params.id
    );

    if (applied && !existingAppliedJob) {
      req.user.appliedJobs.push({ job: req.params.id, appliedAt: new Date() });
    }

    if (!applied) {
      req.user.appliedJobs = req.user.appliedJobs.filter(
        (appliedJob) => appliedJob.job.toString() !== req.params.id
      );
    }

    await req.user.save();

    const savedAppliedJob = req.user.appliedJobs.find(
      (appliedJob) => appliedJob.job.toString() === req.params.id
    );

    res.json({
      job: {
        ...job,
        advertisementUrl: buildAdvertisementUrl(job),
        applied: Boolean(savedAppliedJob),
        appliedAt: savedAppliedJob?.appliedAt || null,
      },
    });
  } catch (error) {
    next(error);
  }
}
