import { AlertTriangle, Check, CreditCard, Send, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { StatusMessage } from "../components/StatusMessage.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { describeLimit, describeReminderStages, isUnlimited } from "../utils/plan.js";

const STATUS_TONES = { approved: "success", rejected: "danger", pending: "warning" };

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

/**
 * The feature rows are built from the catalog the server sent, not hardcoded here,
 * so the pricing table always matches what is actually enforced.
 */
function buildComparison(plans) {
  const free = plans.find((plan) => plan.key === "free");
  const pro = plans.find((plan) => plan.key === "pro");
  if (!free || !pro) return [];

  const row = (label, pick) => ({ label, free: pick(free), pro: pick(pro) });

  return [
    row("Keywords", (plan) => describeLimit(plan.limits.keywords)),
    row("Digest time", (plan) => plan.limits.notificationTime || "Any time you choose"),
    row("Digest frequency", (plan) =>
      plan.limits.notificationFrequencies.map((item) => item[0].toUpperCase() + item.slice(1)).join(" + ")
    ),
    row("Deadline reminders", (plan) => describeReminderStages(plan.limits.reminderStages)),
    row("Manual scans", (plan) =>
      isUnlimited(plan.limits.manualScansPerDay)
        ? "Unlimited"
        : `${plan.limits.manualScansPerDay} per day`
    ),
  ];
}

function SubscriptionBanner({ entitlements }) {
  const { plan, label, storedPlan, expiresAt, daysRemaining, inGrace, onHold } = entitlements;

  if (onHold) {
    return (
      <div className="billing-banner warn">
        <AlertTriangle size={18} />
        <div>
          <strong>Payment under review</strong>
          <p>Your {label} access continues while we verify your transaction.</p>
        </div>
      </div>
    );
  }

  if (inGrace) {
    return (
      <div className="billing-banner warn">
        <AlertTriangle size={18} />
        <div>
          <strong>Your {label} plan has expired</strong>
          <p>You keep {label} for a few more days. Renew below to avoid losing it.</p>
        </div>
      </div>
    );
  }

  if (plan === "free" && storedPlan !== "free") {
    return (
      <div className="billing-banner warn">
        <AlertTriangle size={18} />
        <div>
          <strong>Your Pro plan has ended</strong>
          <p>You are back on Free. Renew below to restore your Pro features.</p>
        </div>
      </div>
    );
  }

  if (plan === "free") {
    return (
      <div className="billing-banner">
        <Sparkles size={18} />
        <div>
          <strong>You are on the Free plan</strong>
          <p>Upgrade for unlimited keywords, your own digest time and earlier deadline reminders.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="billing-banner ok">
      <Check size={18} />
      <div>
        <strong>{label} is active</strong>
        <p>
          {daysRemaining} day{daysRemaining === 1 ? "" : "s"} remaining, until {formatDate(expiresAt)}.
        </p>
      </div>
    </div>
  );
}

export function BillingPage() {
  const { apiFetch, entitlements, setUser } = useAuth();
  const [catalog, setCatalog] = useState(null);
  const [payments, setPayments] = useState([]);
  const [providerRef, setProviderRef] = useState("");
  const [senderNumber, setSenderNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("");

  async function load() {
    try {
      const [plansData, paymentsData] = await Promise.all([
        apiFetch("/api/billing/plans"),
        apiFetch("/api/billing/payments"),
      ]);
      setCatalog(plansData);
      setPayments(paymentsData.payments || []);
    } catch (error) {
      setStatus(error.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submitPayment(event) {
    event.preventDefault();
    setSubmitting(true);
    setStatus("");

    try {
      const data = await apiFetch("/api/billing/payments", {
        method: "POST",
        body: JSON.stringify({ providerRef, senderNumber }),
      });
      setStatus(data.message);
      setProviderRef("");
      setSenderNumber("");
      await load();
      // The submission may have opened a hold, which changes entitlements.
      const me = await apiFetch("/api/auth/me");
      setUser(me.user);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  const pro = catalog?.plans?.find((plan) => plan.key === "pro");
  const comparison = catalog ? buildComparison(catalog.plans) : [];
  const hasPending = payments.some((payment) => payment.status === "pending");

  return (
    <section className="billing-view">
      <div className="toolbar">
        <div>
          <h2>Billing</h2>
          <p>Manage your plan and submit manual bKash payments</p>
        </div>
      </div>

      <SubscriptionBanner entitlements={entitlements} />
      <StatusMessage message={status} />

      {comparison.length > 0 && (
        <section className="profile-section">
          <header>
            <Sparkles size={18} />
            <h3>Plans</h3>
          </header>

          <div className="admin-table-wrap">
            <table className="admin-users-table billing-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Free</th>
                  <th>Pro — BDT {pro?.priceBdt} / {pro?.periodDays} days</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((row) => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td>{row.free}</td>
                    <td className="billing-pro-cell">{row.pro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="profile-section">
        <header>
          <CreditCard size={18} />
          <h3>Renew or Upgrade</h3>
        </header>

        <ol className="billing-steps">
          <li>
            Send <strong>BDT {pro?.priceBdt ?? 99}</strong> to bKash{" "}
            <strong>{catalog?.payment?.bkashNumber || "(number not configured)"}</strong>
          </li>
          <li>Copy the transaction ID from your bKash confirmation</li>
          <li>Submit it below — your plan activates once we verify it</li>
        </ol>

        {hasPending && (
          <p className="status">
            You have a payment awaiting review. There is no need to submit it again.
          </p>
        )}

        <form className="billing-form" onSubmit={submitPayment}>
          <label>
            <span>Transaction ID</span>
            <input
              value={providerRef}
              onChange={(event) => setProviderRef(event.target.value)}
              placeholder="e.g. AB12CD34EF"
              required
            />
          </label>

          <label>
            <span>bKash number you paid from</span>
            <input
              value={senderNumber}
              onChange={(event) => setSenderNumber(event.target.value)}
              placeholder="01XXXXXXXXX"
            />
          </label>

          <button type="submit" disabled={submitting}>
            <Send size={16} />
            {submitting ? "Submitting" : "Submit payment"}
          </button>
        </form>
      </section>

      <section className="profile-section">
        <header>
          <Check size={18} />
          <h3>Payment History</h3>
        </header>

        {payments.length === 0 ? (
          <div className="empty">No payments yet</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-users-table billing-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Reference</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Covers until</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment._id}>
                    <td>{formatDate(payment.createdAt)}</td>
                    <td className="billing-ref">{payment.providerRef}</td>
                    <td>BDT {payment.amountBdt}</td>
                    <td>
                      <span className={`status-badge ${STATUS_TONES[payment.status] || "muted"}`}>
                        {payment.status}
                      </span>
                    </td>
                    <td>{formatDate(payment.periodEnd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
