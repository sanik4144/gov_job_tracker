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
let runDailyInProgress = false;
let dbConnectionError = null;
const dbReady = connectDb().catch((error) => {
  dbConnectionError = error;
  console.error("MongoDB connection failed:", error);
  throw error;
});

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);

      const normalizedOrigin = origin.replace(/\/+$/, "");
      if (env.frontendOrigins.includes(normalizedOrigin)) {
        return callback(null, origin);
      }

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
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

async function ensureDbReady() {
  if (dbConnectionError) throw dbConnectionError;
  await dbReady;
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
    await ensureDbReady();
    await ensureDefaultKeyword();
    const keywords = await Keyword.find({ active: true }).sort({ value: 1 });
    res.json({ keywords });
  } catch (error) {
    next(error);
  }
});

app.post("/api/keywords", async (req, res, next) => {
  try {
    await ensureDbReady();
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
    await ensureDbReady();
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
    await ensureDbReady();
    const filter = {};
    if (req.query.keyword) {
      filter.keywords = String(req.query.keyword);
    }
    if (req.query.applied === "true") {
      filter.applied = true;
    }

    const includeExpired = req.query.includeExpired === "true";
    const resultLimit = req.query.applied === "true" ? undefined : 100;

    const jobs = await Job.find(filter).lean();
    const visibleJobs = jobs
      .map((job) => {
        const deadlineMeta = getDeadlineMeta(job.deadline);
        return { ...job, ...deadlineMeta };
      })
      .filter((job) => includeExpired || !job.isExpired)
      .sort((a, b) => a.deadlineTime - b.deadlineTime || a.title.localeCompare(b.title))
      .slice(0, resultLimit)
      .map(({ deadlineTime, ...job }) => job);

    res.json({ jobs: visibleJobs });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/jobs/:id/applied", async (req, res, next) => {
  try {
    await ensureDbReady();
    const applied = Boolean(req.body?.applied);
    const job = await Job.findByIdAndUpdate(
      req.params.id,
      {
        applied,
        appliedAt: applied ? new Date() : null,
      },
      { new: true }
    );

    if (!job) return res.status(404).json({ error: "Job not found" });
    res.json({ job });
  } catch (error) {
    next(error);
  }
});

async function handleRunDaily(req, res, next) {
  const startedAt = Date.now();
  const isExternalCronRequest = !req.header("origin") && Boolean(req.header("x-cron-secret"));
  const runInBackground =
    isExternalCronRequest ||
    req.query.background === "true" ||
    req.body?.background === true ||
    req.body?.async === true;
  const requestSource = {
    origin: req.header("origin") || "no-origin",
    userAgent: req.header("user-agent") || "unknown",
    ip: req.ip,
  };

  console.log("[run-daily] Request received", {
    ...requestSource,
    notify: req.body?.notify !== false,
    background: runInBackground,
    time: new Date().toISOString(),
  });

  try {
    if (env.cronSecret && req.header("x-cron-secret") !== env.cronSecret) {
      console.warn("[run-daily] Unauthorized request", requestSource);
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (runDailyInProgress) {
      console.log("[run-daily] Already running", requestSource);
      return res.status(202).json({
        accepted: true,
        running: true,
        message: "Daily job check is already running",
      });
    }

    if (runInBackground) {
      runDailyInProgress = true;
      res.status(202).json({
        accepted: true,
        running: true,
        message: "Daily job check started",
      });

      setImmediate(async () => {
        try {
          await ensureDbReady();
          const result = await runDailyJobCheck({ notify: req.body?.notify !== false });
          console.log("[run-daily] Background completed", {
            durationMs: Date.now() - startedAt,
            keywords: result.keywords,
            found: result.found,
            new: result.new,
            notificationError: result.notificationError,
          });
        } catch (error) {
          console.error("[run-daily] Background failed", {
            durationMs: Date.now() - startedAt,
            message: error.message,
          });
        } finally {
          runDailyInProgress = false;
        }
      });

      return;
    }

    runDailyInProgress = true;
    await ensureDbReady();
    const result = await runDailyJobCheck({ notify: req.body?.notify !== false });
    runDailyInProgress = false;
    console.log("[run-daily] Completed", {
      durationMs: Date.now() - startedAt,
      keywords: result.keywords,
      found: result.found,
      new: result.new,
      notificationError: result.notificationError,
    });

    res.json(result);
  } catch (error) {
    runDailyInProgress = false;
    console.error("[run-daily] Failed", {
      durationMs: Date.now() - startedAt,
      message: error.message,
    });
    next(error);
  }
}

app.get("/api/run-daily", handleRunDaily);
app.post("/api/run-daily", handleRunDaily);

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({
    error: "Something went wrong",
    details: env.nodeEnv === "development" ? error.message : undefined,
  });
});

app.listen(env.port, () => {
  console.log(`Backend running on port ${env.port}`);
});

dbReady
  .then(() => {
    if (env.enableInternalScheduler) {
      startScheduler();
    } else {
      console.log("Internal scheduler disabled");
    }
  })
  .catch(() => {
    console.error("Startup continued, but database-dependent routes will fail until restart");
  });
