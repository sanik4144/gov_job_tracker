import cors from "cors";
import express from "express";
import { env, requireEnv } from "./config/env.js";
import { initDbConnection } from "./db.js";
import adminRouter from "./routes/adminRouter.js";
import authRouter from "./routes/authRouter.js";
import billingRouter from "./routes/billingRouter.js";
import jobRouter from "./routes/jobRouter.js";
import keywordRouter from "./routes/keywordRouter.js";
import runCheckRouter from "./routes/runCheckRouter.js";
import telegramRouter from "./routes/telegramRouter.js";
import { startScheduler } from "./scheduler.js";

requireEnv();

const app = express();
const dbReady = initDbConnection();

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

app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/billing", billingRouter);
app.use("/api/keywords", keywordRouter);
app.use("/api/jobs", jobRouter);
app.use("/api/run-daily", runCheckRouter);
app.use("/api/telegram", telegramRouter);

// Keep the original auth paths available while the frontend uses /api/auth/*.
app.use(authRouter);

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
