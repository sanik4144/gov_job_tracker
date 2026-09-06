import { Sparkles, X } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Shown when the backend answers 402. The copy comes from the server's message, so
 * the limit quoted here is always the one that was actually enforced.
 */
export function PlanLimitNotice({ limit, onDismiss }) {
  if (!limit) return null;

  return (
    <div className="plan-limit-notice">
      <Sparkles size={18} />
      <p>{limit.message}</p>
      <Link to="/billing" className="plan-limit-cta">
        Upgrade
      </Link>
      <button type="button" onClick={onDismiss} title="Dismiss">
        <X size={16} />
      </button>
    </div>
  );
}
