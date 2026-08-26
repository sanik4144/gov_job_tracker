import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      match: /.+\@.+\..+/,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    phone: {
      type: String,
      trim: true,
    },
    avatar: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    telegramId: {
      type: String,
      default: null,
    },
    whatsappId: {
      type: String,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    notificationsEnabled: {
      type: Boolean,
      default: true,
    },
    notificationFrequency: {
      type: String,
      enum: ["daily", "weekly"],
      default: "daily",
    },
    notificationTime: {
      type: String,
      default: "19:00",
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
    },
    notificationDayOfWeek: {
      type: Number,
      min: 0,
      max: 6,
      default: 0,
    },
    lastNotificationCheckAt: {
      type: Date,
      default: null,
    },
    plan: {
      type: String,
      enum: ["free", "pro", "team"],
      default: "free",
    },
    subscriptionStatus: {
      type: String,
      enum: ["free", "trialing", "active", "past_due", "canceled"],
      default: "free",
    },
    subscriptionEndsAt: {
      type: Date,
      default: null,
    },
    appliedJobs: [
      {
        job: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Job",
          required: true,
        },
        appliedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

userSchema.methods.toSafeJSON = function toSafeJSON() {
  const user = this.toObject();
  delete user.password;
  delete user.appliedJobs;
  return user;
};

export default mongoose.model("User", userSchema);
