/**
 * Responses for actions a plan does not allow.
 *
 * 402 rather than 403 on purpose: 403 means "you may not", 402 means "you may, if
 * you pay". The client branches on that one status to offer an upgrade instead of
 * showing a generic failure, so every plan-blocked action must use these helpers.
 *
 * Both `error` and `message` are set because this codebase reads either.
 */
const UPGRADE_TARGET = "pro";

function sendPaymentRequired(res, body) {
  return res.status(402).json({
    error: body.message,
    message: body.message,
    upgradeTo: UPGRADE_TARGET,
    ...body,
  });
}

export function sendPlanLimit(res, { feature, limit, message }) {
  return sendPaymentRequired(res, { code: "PLAN_LIMIT", feature, limit, message });
}

export function sendFeatureLocked(res, { feature, message }) {
  return sendPaymentRequired(res, { code: "PLAN_FEATURE", feature, limit: null, message });
}
