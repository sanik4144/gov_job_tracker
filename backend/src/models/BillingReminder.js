import mongoose from "mongoose";

/**
 * One row per (user, period end, stage) renewal notice delivered.
 *
 * Keyed on the period end rather than a date: when a user renews,
 * `subscriptionEndsAt` moves, the key changes, and the next cycle's ladder arms
 * itself. Nothing has to reset a flag or clean up old rows.
 */
const billingReminderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // The subscriptionEndsAt this notice was about, to the millisecond.
    periodEnd: {
      type: Date,
      required: true,
    },
    // Which rung: "t3", "t1", "t0" or "lapsed".
    stage: {
      type: String,
      required: true,
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

billingReminderSchema.index({ userId: 1, periodEnd: 1, stage: 1 }, { unique: true });

export const BillingReminder = mongoose.model("BillingReminder", billingReminderSchema);
