import { env } from "../config/env.js";
import { PLANS } from "../config/plans.js";
import { BillingReminder } from "../models/BillingReminder.js";
import { sendTelegramMessage } from "./telegram.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function escapeHtml(value = "") {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/**
 * The renewal ladder, in the order it fires. `within` is days remaining before the
 * period ends, so the lapsed rung sits past the grace window at a negative value.
 */
function getStages() {
  return [
    { key: "t3", within: 3 },
    { key: "t1", within: 1 },
    { key: "t0", within: 0 },
    { key: "lapsed", within: -env.subscriptionGraceDays },
  ];
}

function getBillingUrl() {
  const origin = env.frontendOrigins[0] || "";

  return origin ? `${origin}/billing` : "";
}

/**
 * Which rungs this user is owed right now.
 *
 * Same "has reached, not equals" rule as the deadline ladder, so a rung missed
 * because a run failed still fires later rather than being skipped.
 */
export async function getDueBillingNotices(user, now = new Date()) {
  if (!user?.subscriptionEndsAt) return { stages: [], daysRemaining: null, periodEnd: null };

  const periodEnd = new Date(user.subscriptionEndsAt);
  if (Number.isNaN(periodEnd.getTime())) {
    return { stages: [], daysRemaining: null, periodEnd: null };
  }

  // Only a paid record is worth nudging. A user who never bought anything has
  // nothing to renew.
  const plan = PLANS[user.plan];
  if (!plan || plan.priceBdt === 0) {
    return { stages: [], daysRemaining: null, periodEnd: null };
  }

  const daysRemaining = Math.ceil((periodEnd.getTime() - now.getTime()) / DAY_MS);
  const sent = await BillingReminder.find({ userId: user._id, periodEnd })
    .select("stage")
    .lean();
  const sentStages = new Set(sent.map((entry) => entry.stage));
  const stages = getStages().filter(
    (stage) => daysRemaining <= stage.within && !sentStages.has(stage.key)
  );

  return { stages, daysRemaining, periodEnd };
}

function formatBillingNotice({ user, stages, daysRemaining }) {
  const plan = PLANS[user.plan];
  const planLabel = escapeHtml(plan?.label || user.plan);
  const billingUrl = getBillingUrl();
  const hasLapsed = stages.some((stage) => stage.key === "lapsed");
  const lines = [];

  if (hasLapsed) {
    const freePlan = PLANS.free;

    lines.push(
      `<b>Your ${planLabel} plan has ended</b>`,
      "",
      `You are back on ${escapeHtml(freePlan.label)}: ${freePlan.limits.keywords} keywords, ` +
        "last-day deadline reminders, and one manual scan a day.",
      "",
      `Renew any time for BDT ${plan?.priceBdt} to restore unlimited keywords, your own ` +
        "digest time and the full reminder ladder."
    );
  } else {
    const when =
      daysRemaining <= 0
        ? "today"
        : `in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`;

    lines.push(
      `<b>Your ${planLabel} plan expires ${when}</b>`,
      "",
      `Expires: ${escapeHtml(new Date(user.subscriptionEndsAt).toISOString().slice(0, 10))}`,
      "",
      `Renew for BDT ${plan?.priceBdt} to keep unlimited keywords, your own digest time ` +
        "and the full reminder ladder."
    );
  }

  if (env.bkashNumber) {
    lines.push("", `Send bKash to: <b>${escapeHtml(env.bkashNumber)}</b>`);
  }

  if (billingUrl) {
    lines.push(`Then submit your transaction ID: ${escapeHtml(billingUrl)}`);
  }

  return lines.join("\n");
}

async function recordBillingNotices(userId, periodEnd, stages) {
  if (stages.length === 0) return;

  try {
    await BillingReminder.insertMany(
      stages.map((stage) => ({ userId, periodEnd, stage: stage.key, sentAt: new Date() })),
      { ordered: false }
    );
  } catch (error) {
    if (error.code !== 11000 && error.writeErrors?.some((item) => item.err?.code !== 11000)) {
      throw error;
    }
  }
}

/**
 * Sends the renewal notice if one is owed. Returns the number of rungs delivered.
 *
 * Recorded only after the send succeeds, so a failed notice is retried on the next
 * run rather than silently marked delivered.
 */
export async function sendBillingNoticeIfDue(user, now = new Date()) {
  if (!user?.telegramId) return 0;

  const { stages, daysRemaining, periodEnd } = await getDueBillingNotices(user, now);
  if (stages.length === 0) return 0;

  // Several rungs owed at once collapse into one message rather than a burst.
  const text = formatBillingNotice({ user, stages, daysRemaining });

  await sendTelegramMessage(text, user.telegramId);
  await recordBillingNotices(user._id, periodEnd, stages);

  return stages.length;
}
