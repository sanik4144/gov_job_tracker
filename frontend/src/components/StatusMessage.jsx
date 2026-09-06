import { AlertCircle, CheckCircle2, Info } from "lucide-react";

const TONE_ICONS = {
  info: Info,
  success: CheckCircle2,
  error: AlertCircle,
};

/**
 * Feedback banner. `tone` defaults to "info" so existing call sites keep their
 * appearance; pass "error" or "success" where the outcome is known.
 *
 * role="alert" matters: without it a screen reader never announces a failure that
 * appears after the user submits.
 */
export function StatusMessage({ message, tone = "info" }) {
  if (!message) return null;

  const Icon = TONE_ICONS[tone] || Info;

  return (
    <p className={`status status--${tone}`} role={tone === "error" ? "alert" : "status"}>
      <Icon size={16} aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
}
