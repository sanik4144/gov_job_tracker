import express from "express";
import cors from "cors";
import { env, requireEnv } from "./config/env.js";
import { connectDb } from "./db.js";
import { Job } from "./models/Job.js";
import { runDailyJobCheck } from "./services/notifier.js";
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

app.get("/api/jobs", async (_req, res, next) => {
  try {
    const jobs = await Job.find().sort({ createdAt: -1 }).limit(50);
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
