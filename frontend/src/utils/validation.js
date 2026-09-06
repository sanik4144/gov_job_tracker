/**
 * Client-side checks for the manual payment form.
 *
 * These are a courtesy, not a guard — the backend validates and rejects
 * independently. Their job is to catch a typo before it costs the user a round trip
 * and an admin a rejected transaction.
 */

// bKash transaction IDs are short alphanumeric codes, no separators.
const TRX_PATTERN = /^[A-Za-z0-9]{6,20}$/;
// Bangladeshi mobile numbers: 11 digits starting 01.
const PHONE_PATTERN = /^01\d{9}$/;

export function validateTransactionId(value) {
  const trimmed = String(value || "").trim();

  if (!trimmed) return "Enter the transaction ID from your bKash confirmation";
  if (!TRX_PATTERN.test(trimmed)) {
    return "Transaction IDs are 6-20 letters and numbers, with no spaces or dashes";
  }

  return "";
}

export function validateSenderNumber(value) {
  const trimmed = String(value || "").replace(/[\s-]/g, "");

  // Optional: an admin can still match the payment by transaction ID alone.
  if (!trimmed) return "";
  if (!PHONE_PATTERN.test(trimmed)) {
    return "Enter an 11-digit number starting with 01, or leave this empty";
  }

  return "";
}

export function validatePaymentForm({ providerRef, senderNumber }) {
  const errors = {
    providerRef: validateTransactionId(providerRef),
    senderNumber: validateSenderNumber(senderNumber),
  };

  return {
    errors,
    isValid: Object.values(errors).every((message) => !message),
  };
}
