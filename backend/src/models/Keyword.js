import mongoose from "mongoose";

const keywordSchema = new mongoose.Schema(
  {
    value: {
      type: String,
      required: true,
      trim: true,
    },
    normalizedValue: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

keywordSchema.index({ userId: 1, normalizedValue: 1 }, { unique: true });

export const Keyword = mongoose.model("Keyword", keywordSchema);
