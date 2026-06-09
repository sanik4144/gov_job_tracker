import mongoose from "mongoose";

const jobSchema = new mongoose.Schema(
  {
    externalId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    organization: String,
    deadline: String,
    detailUrl: String,
    sourceUrl: {
      type: String,
      required: true,
    },
    rawText: String,
    firstSeenAt: {
      type: Date,
      default: Date.now,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
    notifiedAt: Date,
  },
  { timestamps: true }
);

export const Job = mongoose.model("Job", jobSchema);
