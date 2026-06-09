import mongoose from "mongoose";

const keywordSchema = new mongoose.Schema(
  {
    value: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    normalizedValue: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export const Keyword = mongoose.model("Keyword", keywordSchema);
