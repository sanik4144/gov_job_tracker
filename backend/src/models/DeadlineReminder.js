import mongoose from "mongoose";

/**
 * One row per (user, job, deadline) "closing soon" reminder that was delivered.
 *
 * Deliberately not a `kind` field on JobNotification: that collection's unique
 * {userId, jobId} index is already live in deployed databases, so the same job
 * could never carry both a "new job" row and a reminder row without a manual
 * index migration.
 *
 * The deadline is part of the key because circulars get extended — a job whose
 * deadline moves earns exactly one fresh reminder instead of going quiet forever.
 */
const deadlineReminderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
      index: true,
    },
    // The job's deadline at send time, as the stored YYYY-MM-DD string.
    deadline: {
      type: String,
      required: true,
    },
    // Which rung of the plan's ladder this was: days before the deadline, 0 being
    // the last day. Part of the key so a job can be reminded at 3, then 1, then 0.
    stage: {
      type: Number,
      required: true,
    },
    remindedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Also the idempotency guard: pressing Run Scan twice cannot double-send a reminder.
deadlineReminderSchema.index({ userId: 1, jobId: 1, deadline: 1, stage: 1 }, { unique: true });

export const DeadlineReminder = mongoose.model("DeadlineReminder", deadlineReminderSchema);
