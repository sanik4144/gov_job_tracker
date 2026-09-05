import mongoose from "mongoose";

/**
 * One row per (user, job) that has actually been delivered to that user.
 *
 * Job documents are shared, so "is this job new?" cannot be answered globally —
 * the first user to scrape a keyword would otherwise consume its newness for
 * everyone else matching the same keyword. This ledger makes newness per-user.
 */
const jobNotificationSchema = new mongoose.Schema(
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
    notifiedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Also the idempotency guard: a retried digest cannot double-record a job.
jobNotificationSchema.index({ userId: 1, jobId: 1 }, { unique: true });

export const JobNotification = mongoose.model("JobNotification", jobNotificationSchema);
