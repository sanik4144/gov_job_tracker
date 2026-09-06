import { Check, Gift, RefreshCcw, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { StatusMessage } from "../components/StatusMessage.jsx";
import { useAuth } from "../context/AuthContext.jsx";

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

const STATUS_TONES = { approved: "success", rejected: "danger", pending: "warning" };

export function AdminPaymentsPage() {
  const { user, apiFetch } = useAuth();
  const [payments, setPayments] = useState([]);
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [status, setStatus] = useState("");

  async function load(nextFilter = filter) {
    setLoading(true);

    try {
      const query = nextFilter === "all" ? "" : `?status=${nextFilter}`;
      const data = await apiFetch(`/api/admin/payments${query}`);
      setPayments(data.payments || []);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(filter);
  }, [filter]);

  async function review(paymentId, action) {
    setBusyId(paymentId);
    setStatus("");

    try {
      const data = await apiFetch(`/api/admin/payments/${paymentId}/${action}`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setStatus(data.message);
      await load(filter);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusyId("");
    }
  }

  if (user?.role !== "admin") {
    return <Navigate to="/jobs" replace />;
  }

  return (
    <section className="admin-view">
      <div className="toolbar">
        <div>
          <h2>Payments</h2>
          <p>Verify manual bKash transactions and activate plans</p>
        </div>

        <div className="actions">
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="all">All</option>
          </select>
          <button type="button" onClick={() => load(filter)} disabled={loading}>
            <RefreshCcw size={16} />
            Refresh
          </button>
        </div>
      </div>

      <StatusMessage message={status} />

      {loading ? (
        <div className="empty">Loading payments</div>
      ) : payments.length === 0 ? (
        <div className="empty">
          <Gift size={22} />
          Nothing to review
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-users-table billing-table">
            <thead>
              <tr>
                <th>Submitted</th>
                <th>User</th>
                <th>Transaction ID</th>
                <th>Paid from</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment._id}>
                  <td>{formatDate(payment.createdAt)}</td>
                  <td>
                    <strong>{payment.user?.name || "Unknown"}</strong>
                    <br />
                    <span className="muted">{payment.user?.email}</span>
                  </td>
                  <td className="billing-ref">{payment.providerRef}</td>
                  <td>{payment.senderNumber || "—"}</td>
                  <td>BDT {payment.amountBdt}</td>
                  <td>
                    <span className={`status-badge ${STATUS_TONES[payment.status] || "neutral"}`}>
                      {payment.status}
                    </span>
                  </td>
                  <td>
                    {payment.status === "pending" ? (
                      <div className="row-actions">
                        <button
                          type="button"
                          onClick={() => review(payment._id, "approve")}
                          disabled={busyId === payment._id}
                          title="Approve and activate"
                        >
                          <Check size={15} />
                          Approve
                        </button>
                        <button
                          type="button"
                          className="kw-cancel"
                          onClick={() => review(payment._id, "reject")}
                          disabled={busyId === payment._id}
                          title="Reject"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    ) : (
                      <span className="muted">
                        {payment.periodEnd ? `until ${formatDate(payment.periodEnd)}` : "—"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
