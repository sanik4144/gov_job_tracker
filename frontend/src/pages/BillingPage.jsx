import {
  AlertCircle,
  BadgeCheck,
  Check,
  Clock3,
  Copy,
  Minus,
  Send,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { StatusMessage } from "../components/StatusMessage.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { describeLimit, describeReminderStages, isUnlimited } from "../utils/plan.js";
import { validatePaymentForm } from "../utils/validation.js";

const STATUS_TONES = { approved: "success", rejected: "danger", pending: "warning" };

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Feature rows are derived from the catalog the server sent, never hardcoded, so the
 * card a user reads always matches what is actually enforced.
 */
function buildFeatures(plan) {
  if (!plan) return [];

  // `included` means the plan genuinely provides the capability, not "is better than
  // free" — otherwise the Free card reads as a list of things you do not get, which
  // is both demoralising and untrue.
  return [
    {
      label: isUnlimited(plan.limits.keywords)
        ? "Unlimited keywords"
        : `${describeLimit(plan.limits.keywords)} keywords`,
      included: true,
    },
    {
      label: plan.limits.notificationTime
        ? `Digest fixed at ${plan.limits.notificationTime}`
        : "Digest at any time you choose",
      included: !plan.limits.notificationTime,
    },
    {
      label: plan.limits.notificationFrequencies.includes("weekly")
        ? "Daily and weekly digests"
        : "Daily digest only",
      included: plan.limits.notificationFrequencies.includes("weekly"),
    },
    {
      label: `Reminders ${describeReminderStages(plan.limits.reminderStages)}`,
      included: plan.limits.reminderStages.length > 0,
    },
    {
      label: isUnlimited(plan.limits.manualScansPerDay)
        ? "Unlimited manual scans"
        : `${plan.limits.manualScansPerDay} manual scan${
            plan.limits.manualScansPerDay === 1 ? "" : "s"
          } a day`,
      included: true,
    },
  ];
}

function PlanCard({ plan, isCurrent, onChoose }) {
  const features = buildFeatures(plan);
  const isPro = plan.priceBdt > 0;

  return (
    <article className={`plan-card${isPro ? " plan-card--pro" : ""}${isCurrent ? " plan-card--current" : ""}`}>
      <header>
        <div>
          <h4>{plan.label}</h4>
          <p className="plan-card-price">
            {isPro ? (
              <>
                <span className="plan-card-amount">BDT {plan.priceBdt}</span>
                <span className="plan-card-period">/ {plan.periodDays} days</span>
              </>
            ) : (
              <span className="plan-card-amount">Free</span>
            )}
          </p>
        </div>
        {isCurrent && (
          <span className="status-badge success">
            <BadgeCheck size={12} />
            Current
          </span>
        )}
      </header>

      <ul className="plan-features">
        {features.map((feature) => (
          <li key={feature.label} className={feature.included ? "on" : "off"}>
            {feature.included ? <Check size={14} /> : <Minus size={14} />}
            {feature.label}
          </li>
        ))}
      </ul>

      {isPro && !isCurrent && (
        <button type="button" className="plan-card-cta" onClick={onChoose}>
          <Sparkles size={15} />
          Upgrade to Pro
        </button>
      )}
    </article>
  );
}

function SubscriptionHero({ entitlements, plans, onRenew }) {
  const { plan, label, expiresAt, daysRemaining, inGrace, onHold, storedPlan, isPaid } = entitlements;
  const periodDays = plans.find((item) => item.key === storedPlan)?.periodDays || 30;
  // Clamped so a long grant cannot overflow the bar, and a lapsed one cannot go
  // negative and render backwards.
  const progress = Math.max(0, Math.min(100, ((daysRemaining ?? 0) / periodDays) * 100));

  let tone = "neutral";
  let heading = "You are on the Free plan";
  let detail = "Upgrade for unlimited keywords, your own digest time and earlier reminders.";
  let Icon = Sparkles;

  if (onHold) {
    tone = "warn";
    Icon = Clock3;
    heading = "Payment under review";
    detail = `Your ${label} access continues while we verify your transaction.`;
  } else if (inGrace) {
    tone = "warn";
    Icon = AlertCircle;
    heading = `Your ${label} plan has expired`;
    detail = "You keep Pro for a few more days. Renew now to avoid losing it.";
  } else if (!isPaid && storedPlan !== "free") {
    tone = "warn";
    Icon = AlertCircle;
    heading = "Your Pro plan has ended";
    detail = "You are back on Free. Renew below to restore your Pro features.";
  } else if (isPaid) {
    tone = "ok";
    Icon = BadgeCheck;
    heading = `${label} is active`;
    detail = `Renews or expires on ${formatDate(expiresAt)}.`;
  }

  return (
    <section className={`billing-hero billing-hero--${tone}`}>
      <div className="billing-hero-main">
        <span className="billing-hero-icon">
          <Icon size={20} />
        </span>
        <div>
          <h3>{heading}</h3>
          <p>{detail}</p>
        </div>
      </div>

      {isPaid && typeof daysRemaining === "number" && (
        <div className="billing-hero-meter">
          <div className="billing-meter-head">
            <strong>{Math.max(0, daysRemaining)}</strong>
            <span>day{daysRemaining === 1 ? "" : "s"} left</span>
          </div>
          <div className="billing-meter-track" role="presentation">
            <span className="billing-meter-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <button type="button" className="billing-hero-cta" onClick={onRenew}>
        {isPaid ? "Renew" : "Upgrade"}
        <Sparkles size={15} />
      </button>
    </section>
  );
}

export function BillingPage() {
  const { apiFetch, entitlements, setUser } = useAuth();
  const [catalog, setCatalog] = useState(null);
  const [payments, setPayments] = useState([]);
  const [form, setForm] = useState({ providerRef: "", senderNumber: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("");
  const [statusTone, setStatusTone] = useState("info");
  const [copied, setCopied] = useState(false);

  async function load() {
    try {
      const [plansData, paymentsData] = await Promise.all([
        apiFetch("/api/billing/plans"),
        apiFetch("/api/billing/payments"),
      ]);
      setCatalog(plansData);
      setPayments(paymentsData.payments || []);
    } catch (error) {
      setStatusTone("error");
      setStatus(error.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const plans = catalog?.plans || [];
  const pro = plans.find((plan) => plan.key === "pro");
  const validation = useMemo(() => validatePaymentForm(form), [form]);
  const hasPending = payments.some((payment) => payment.status === "pending");

  // A server error always shows. Live validation waits until the field has been left,
  // so the form does not scold someone who is still typing.
  function visibleError(field) {
    return fieldErrors[field] || (touched[field] ? validation.errors[field] : "");
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    // Clear a server-side error as soon as the value it referred to changes.
    setFieldErrors((current) => ({ ...current, [field]: "" }));
  }

  function focusPaymentForm() {
    const input = document.getElementById("billing-trx");
    input?.scrollIntoView({ behavior: "smooth", block: "center" });
    input?.focus({ preventScroll: true });
  }

  async function copyNumber() {
    const number = catalog?.payment?.bkashNumber;
    if (!number) return;

    try {
      await navigator.clipboard.writeText(number);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard access can be denied; the number is on screen either way.
      setCopied(false);
    }
  }

  async function submitPayment(event) {
    event.preventDefault();
    setTouched({ providerRef: true, senderNumber: true });

    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      setStatusTone("error");
      setStatus("Check the highlighted fields and try again.");
      return;
    }

    setSubmitting(true);
    setStatus("");
    setFieldErrors({});

    try {
      const data = await apiFetch("/api/billing/payments", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setStatusTone("success");
      setStatus(data.message);
      setForm({ providerRef: "", senderNumber: "" });
      setTouched({});
      await load();
      // The submission may have opened a hold, which changes entitlements.
      const me = await apiFetch("/api/auth/me");
      setUser(me.user);
    } catch (error) {
      // A bad or duplicate transaction ID is a problem with one field, so point at
      // that field instead of repeating the same sentence in a banner above it.
      if (error.code === "DUPLICATE_REF" || error.code === "INVALID_REF") {
        setFieldErrors({ providerRef: error.message });
        setStatus("");
        return;
      }

      setStatusTone("error");
      setStatus(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="billing-view">
      <div className="toolbar">
        <div>
          <h2>Billing</h2>
          <p>Manage your plan and submit manual bKash payments</p>
        </div>
      </div>

      <SubscriptionHero entitlements={entitlements} plans={plans} onRenew={focusPaymentForm} />

      {plans.length > 0 && (
        <div className="plan-grid">
          {plans.map((plan) => (
            <PlanCard
              key={plan.key}
              plan={plan}
              isCurrent={entitlements.plan === plan.key}
              onChoose={focusPaymentForm}
            />
          ))}
        </div>
      )}

      <div className="billing-columns">
        <section className="profile-section billing-pay">
          <header>
            <Send size={18} />
            <h3>Renew or Upgrade</h3>
          </header>

          <ol className="billing-steps">
            <li>
              <span>Send BDT {pro?.priceBdt ?? 99} to this bKash number</span>
              <button
                type="button"
                className={`billing-copy${copied ? " is-copied" : ""}`}
                onClick={copyNumber}
                disabled={!catalog?.payment?.bkashNumber}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {catalog?.payment?.bkashNumber || "Number not configured"}
              </button>
            </li>
            <li>
              <span>Copy the transaction ID from your bKash confirmation SMS</span>
            </li>
            <li>
              <span>Submit it below. Your plan activates once we verify it.</span>
            </li>
          </ol>

          {hasPending && (
            <StatusMessage
              tone="info"
              message="You already have a payment awaiting review. There is no need to submit it again."
            />
          )}

          {/* Placed with the form, not at the top of the page — an error about this
              input is useless if it renders above the fold. */}
          <StatusMessage message={status} tone={statusTone} />

          <form className="billing-form" onSubmit={submitPayment} noValidate>
            <label className={visibleError("providerRef") ? "has-error" : ""}>
              <span>Transaction ID</span>
              <input
                id="billing-trx"
                value={form.providerRef}
                onChange={(event) => updateField("providerRef", event.target.value)}
                onBlur={() => setTouched((current) => ({ ...current, providerRef: true }))}
                placeholder="e.g. AB12CD34EF"
                aria-invalid={Boolean(visibleError("providerRef"))}
                aria-describedby={visibleError("providerRef") ? "billing-trx-error" : undefined}
                autoComplete="off"
              />
              {visibleError("providerRef") && (
                <small id="billing-trx-error" className="field-error" role="alert">
                  <AlertCircle size={13} />
                  {visibleError("providerRef")}
                </small>
              )}
            </label>

            <label className={visibleError("senderNumber") ? "has-error" : ""}>
              <span>
                bKash number <em>optional</em>
              </span>
              <input
                value={form.senderNumber}
                onChange={(event) => updateField("senderNumber", event.target.value)}
                onBlur={() => setTouched((current) => ({ ...current, senderNumber: true }))}
                placeholder="01XXXXXXXXX"
                inputMode="numeric"
                aria-invalid={Boolean(visibleError("senderNumber"))}
                aria-describedby={visibleError("senderNumber") ? "billing-phone-error" : undefined}
                autoComplete="tel"
              />
              {visibleError("senderNumber") && (
                <small id="billing-phone-error" className="field-error" role="alert">
                  <AlertCircle size={13} />
                  {visibleError("senderNumber")}
                </small>
              )}
            </label>

            <button type="submit" className="billing-submit" disabled={submitting}>
              <Send size={15} />
              {submitting ? "Submitting" : "Submit payment"}
            </button>
          </form>
        </section>

        <section className="profile-section billing-history">
          <header>
            <Clock3 size={18} />
            <h3>History</h3>
          </header>

          {payments.length === 0 ? (
            <div className="empty">No payments yet</div>
          ) : (
            <ul className="payment-list">
              {payments.map((payment) => (
                <li key={payment._id}>
                  <div className="payment-row-main">
                    <span className="billing-ref">{payment.providerRef}</span>
                    <span className={`status-badge ${STATUS_TONES[payment.status] || "muted"}`}>
                      {payment.status}
                    </span>
                  </div>
                  <div className="payment-row-meta">
                    <span>{formatDate(payment.createdAt)}</span>
                    <span>BDT {payment.amountBdt}</span>
                    {payment.periodEnd && <span>covers to {formatDate(payment.periodEnd)}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  );
}
