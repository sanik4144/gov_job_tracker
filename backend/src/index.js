import express from "express";
import cors from "cors";
import { env, requireEnv } from "./config/env.js";
import { connectDb } from "./db.js";
import { Job } from "./models/Job.js";
import { Keyword } from "./models/Keyword.js";
import { ensureDefaultKeyword, runDailyJobCheck } from "./services/notifier.js";
import { startScheduler } from "./scheduler.js";

requireEnv();

const app = express();

app.use(
  cors({
    origin: env.frontendOrigin,
  })
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "gov-job-tracker-backend",
    time: new Date().toISOString(),
  });
});

function normalizeKeyword(value = "") {
  return value.trim().toLowerCase();
}

function getTodayUtcDateOnly() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function getDeadlineMeta(deadline) {
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

app.get("/api/keywords", async (_req, res, next) => {
  try {
    await ensureDefaultKeyword();
    const keywords = await Keyword.find({ active: true }).sort({ value: 1 });
    res.json({ keywords });
  } catch (error) {
    next(error);
  }
});

app.post("/api/keywords", async (req, res, next) => {
  try {
    const value = String(req.body?.value || "").trim();
    if (!value) return res.status(400).json({ error: "Keyword is required" });

    const normalizedValue = normalizeKeyword(value);
    const keyword = await Keyword.findOneAndUpdate(
      { normalizedValue },
      { value, normalizedValue, active: true },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.status(201).json({ keyword });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/keywords/:id", async (req, res, next) => {
  try {
    const keyword = await Keyword.findByIdAndDelete(req.params.id);

    if (!keyword) return res.status(404).json({ error: "Keyword not found" });

    const pulled = await Job.updateMany(
      { keywords: keyword.value },
      { $pull: { keywords: keyword.value } }
    );
    const deletedJobs = await Job.deleteMany({
      $or: [{ keywords: { $exists: false } }, { keywords: { $size: 0 } }],
    });

    res.json({
      keyword,
      affectedJobs: pulled.modifiedCount,
      deletedJobs: deletedJobs.deletedCount,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/jobs", async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.keyword) {
      filter.keywords = String(req.query.keyword);
    }

    const jobs = await Job.find(filter).lean();
    const activeJobs = jobs
      .map((job) => {
        const deadlineMeta = getDeadlineMeta(job.deadline);
        return { ...job, ...deadlineMeta };
      })
      .filter((job) => !job.isExpired)
      .sort((a, b) => a.deadlineTime - b.deadlineTime || a.title.localeCompare(b.title))
      .slice(0, 100)
      .map(({ deadlineTime, isExpired, ...job }) => job);

    res.json({ jobs: activeJobs });
  } catch (error) {
    next(error);
  }
});

app.post("/api/run-daily", async (req, res, next) => {
  try {
    if (env.cronSecret && req.header("x-cron-secret") !== env.cronSecret) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await runDailyJobCheck({ notify: req.body?.notify !== false });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({
    error: "Something went wrong",
    details: env.nodeEnv === "development" ? error.message : undefined,
  });
});

await connectDb();
startScheduler();

app.listen(env.port, () => {
  console.log(`Backend running on port ${env.port}`);
});
