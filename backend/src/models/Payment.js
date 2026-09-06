import mongoose from "mongoose";

/**
 * One row per payment attempt, append-only.
 *
 * `user.plan` and `user.subscriptionEndsAt` are a derived cache of what this ledger
 * says; this collection is the record of why. With manual bKash verification that
 * matters from day one — every "why is this user Pro?" and every disputed
 * transaction is answered here, not by a mutated flag.
 */
const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // The plan this payment buys, as a key in config/plans.js.
    plan: {
      type: String,
      required: true,
    },
    provider: {
      type: String,
      required: true,
      default: "manual-bkash",
    },
    // The bKash transaction ID, or a generated reference for an admin grant.
    providerRef: {
      type: String,
      required: true,
      trim: true,
    },
    // Normalized form the uniqueness check runs on, so casing or stray spaces
    // cannot smuggle the same transaction in twice.
    normalizedRef: {
      type: String,
      required: true,
    },
    // The number the money came from, so the admin can match it against a bKash
    // statement without asking.
    senderNumber: {
      type: String,
      trim: true,
      default: "",
    },
    amountBdt: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    // The subscription window this payment opened. Set on approval.
    periodStart: { type: Date, default: null },
    periodEnd: { type: Date, default: null },
    periodDays: { type: Number, default: null },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, default: "" },
  },
  { timestamps: true }
);

// A transaction ID is claimed once, globally. This is what stops a user resubmitting
// someone else's TrxID, and stops a double-clicked Approve granting two periods.
paymentSchema.index({ provider: 1, normalizedRef: 1 }, { unique: true });
paymentSchema.index({ status: 1, createdAt: -1 });

export const Payment = mongoose.model("Payment", paymentSchema);
