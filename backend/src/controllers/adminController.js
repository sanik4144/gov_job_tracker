import { ensureDbReady } from "../db.js";
import { Keyword } from "../models/Keyword.js";
import { Payment } from "../models/Payment.js";
import User from "../models/User.js";
import {
  BillingError,
  approvePayment,
  grantSubscription,
  rejectPayment,
} from "../services/billing.js";
import { toPaymentView } from "./billingController.js";
import { buildUserPayload } from "../utils/userView.js";

export async function listUsers(req, res, next) {
  try {
    await ensureDbReady();
    const users = await User.find().sort({ createdAt: -1 });
    const keywordCounts = await Keyword.aggregate([
      { $match: { userId: { $ne: null } } },
      { $group: { _id: "$userId", count: { $sum: 1 } } },
    ]);
    const keywordCountByUserId = new Map(
      keywordCounts.map((item) => [item._id.toString(), item.count])
    );

    res.json({
      users: users.map((user) => ({
        ...buildUserPayload(user),
        keywordCount: keywordCountByUserId.get(user._id.toString()) || 0,
        appliedJobCount: user.appliedJobs?.length || 0,
      })),
    });
  } catch (error) {
    next(error);
  }
}

function handleBillingError(error, res, next) {
  if (error instanceof BillingError) {
    return res.status(error.status).json({
      error: error.message,
      message: error.message,
      code: error.code,
    });
  }

  return next(error);
}

export async function listPayments(req, res, next) {
  try {
    await ensureDbReady();
    const filter = {};
    const status = String(req.query.status || "").trim();

    if (["pending", "approved", "rejected"].includes(status)) {
      filter.status = status;
    }

    // Pending first: the queue is a to-do list, not a log.
    const payments = await Payment.find(filter).sort({ status: 1, createdAt: -1 }).limit(200).lean();
    const users = await User.find({ _id: { $in: payments.map((item) => item.userId) } })
      .select("name email telegramId plan subscriptionStatus subscriptionEndsAt")
      .lean();
    const usersById = new Map(users.map((user) => [user._id.toString(), user]));

    res.json({
      payments: payments.map((payment) => ({
        ...toPaymentView(payment),
        user: usersById.get(payment.userId.toString()) || null,
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function approvePaymentHandler(req, res, next) {
  try {
    await ensureDbReady();
    const { payment, user } = await approvePayment(req.params.id, req.user, {
      note: String(req.body?.note || "").trim(),
    });

    res.json({
      message: `Approved. ${user.name} is on ${payment.plan} until ${user.subscriptionEndsAt.toISOString().slice(0, 10)}.`,
      payment: toPaymentView(payment),
      user: buildUserPayload(user),
    });
  } catch (error) {
    handleBillingError(error, res, next);
  }
}

export async function rejectPaymentHandler(req, res, next) {
  try {
    await ensureDbReady();
    const payment = await rejectPayment(req.params.id, req.user, {
      note: String(req.body?.note || "").trim(),
    });

    res.json({ message: "Payment rejected", payment: toPaymentView(payment) });
  } catch (error) {
    handleBillingError(error, res, next);
  }
}

export async function grantSubscriptionHandler(req, res, next) {
  try {
    await ensureDbReady();
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const { payment } = await grantSubscription(user, req.user, {
      planKey: req.body?.plan || "pro",
      days: req.body?.days,
      note: String(req.body?.note || "").trim(),
    });

    res.json({
      message: `Granted ${payment.periodDays} days of ${payment.plan} to ${user.name}.`,
      payment: toPaymentView(payment),
      user: buildUserPayload(user),
    });
  } catch (error) {
    handleBillingError(error, res, next);
  }
}
