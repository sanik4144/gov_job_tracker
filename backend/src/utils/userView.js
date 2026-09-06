import { getEntitlements } from "../services/entitlements.js";

/**
 * The user payload every authenticated endpoint returns.
 *
 * Entitlements ride inside the user object on purpose: every client call site already
 * stores `data.user`, so embedding them here means plan data reaches the whole
 * frontend without threading a second field through each response and each setter.
 */
export function buildUserPayload(user, now = new Date()) {
  return {
    ...user.toSafeJSON(),
    entitlements: getEntitlements(user, now),
  };
}
