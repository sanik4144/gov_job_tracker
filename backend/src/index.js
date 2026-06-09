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
    const keyword = await Keyword.findByIdAndUpdate(
      req.params.id,
      { active: false },
      { new: true }
    );

    if (!keyword) return res.status(404).json({ error: "Keyword not found" });
    res.json({ keyword });
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

    const jobs = await Job.find(filter).sort({ createdAt: -1 }).limit(100);
    res.json({ jobs });
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
