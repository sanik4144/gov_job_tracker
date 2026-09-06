import { env } from "../config/env.js";
import { PLANS } from "../config/plans.js";
import { ensureDbReady } from "../db.js";
import { Payment } from "../models/Payment.js";
import { BillingError, submitManualPayment } from "../services/billing.js";
import { getEntitlements } from "../services/entitlements.js";

function toPaymentView(payment) {
  return {
    _id: payment._id,
    plan: payment.plan,
    provider: payment.provider,
    providerRef: payment.providerRef,
    senderNumber: payment.senderNumber,
    amountBdt: payment.amountBdt,
    status: payment.status,
    periodStart: payment.periodStart,
    periodEnd: payment.periodEnd,
    reviewNote: payment.reviewNote,
    createdAt: payment.createdAt,
    reviewedAt: payment.reviewedAt,
  };
}

export { toPaymentView };

/**
 * The pricing table, served from the same catalog that is enforced, so the page a
 * user reads can never promise something the backend does not grant.
 */
export async function listPlans(_req, res, next) {
  try {
    res.json({
      plans: Object.values(PLANS),
      payment: {
        provider: "manual-bkash",
        bkashNumber: env.bkashNumber,
        holdDays: env.paymentHoldDays,
        graceDays: env.subscriptionGraceDays,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function listMyPayments(req, res, next) {
  try {
    await ensureDbReady();
    const payments = await Payment.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      payments: payments.map(toPaymentView),
      entitlements: getEntitlements(req.user),
    });
  } catch (error) {
    next(error);
  }
}

export async function createPayment(req, res, next) {
  try {
    await ensureDbReady();
    const payment = await submitManualPayment(req.user, {
      providerRef: req.body?.providerRef,
      senderNumber: req.body?.senderNumber,
      planKey: req.body?.plan || "pro",
    });

    res.status(201).json({
      message: "Payment submitted. It will be activated once verified.",
      payment: toPaymentView(payment),
    });
  } catch (error) {
    if (error instanceof BillingError) {
      return res.status(error.status).json({ error: error.message, message: error.message, code: error.code });
    }

    next(error);
  }
}
