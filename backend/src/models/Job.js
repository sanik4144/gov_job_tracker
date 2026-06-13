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
    advertisementFile: String,
    advertisementUrl: String,
    sourceUrl: {
      type: String,
      required: true,
    },
    rawText: String,
    keywords: {
      type: [String],
      default: [],
      index: true,
    },
    firstSeenAt: {
      type: Date,
      default: Date.now,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
    notifiedAt: Date,
    applied: {
      type: Boolean,
      default: false,
      index: true,
    },
    appliedAt: Date,
  },
  { timestamps: true }
);

export const Job = mongoose.model("Job", jobSchema);
