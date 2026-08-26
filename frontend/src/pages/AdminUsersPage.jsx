import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { StatusMessage } from "../components/StatusMessage.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { DAYS_OF_WEEK } from "../utils/profile.js";

function formatDate(value) {
  if (!value) return "Not set";
  return new Date(value).toLocaleString();
}

function formatSchedule(user) {
  if (!user.notificationsEnabled) return "Off";
  if (user.notificationFrequency === "weekly") {
    return `Weekly on ${DAYS_OF_WEEK[user.notificationDayOfWeek || 0]} at ${
      user.notificationTime || "19:00"
    }`;
  }
  return `Daily at ${user.notificationTime || "19:00"}`;
}

function Badge({ tone = "neutral", children }) {
  return <span className={`status-badge ${tone}`}>{children}</span>;
}

export function AdminUsersPage() {
  const { user, apiFetch } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  useEffect(() => {
    async function loadUsers() {
      setLoading(true);
      setStatus("");

      try {
        const data = await apiFetch("/api/admin/users");
        setUsers(data.users || []);
      } catch (error) {
        setStatus(error.message);
      } finally {
        setLoading(false);
      }
    }

    loadUsers();
  }, []);

  if (user?.role !== "admin") {
    return <Navigate to="/jobs" replace />;
  }

  return (
    <section className="admin-view">
      <div className="toolbar">
        <div>
          <h2>Users</h2>
          <p>Registered user details and notification settings</p>
        </div>
      </div>

      <StatusMessage message={status} />

      <section className="admin-table-panel" aria-busy={loading}>
        {loading ? (
          <div className="empty">Loading users</div>
        ) : users.length === 0 ? (
          <div className="empty">No users found</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-users-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Whatsapp</th>
                  <th>Telegram</th>
                  <th>Subscription</th>
                  <th>Notifications</th>
                  <th>Keywords</th>
                  <th>Applied</th>
                  <th>Created</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {users.map((item) => (
                  <tr key={item._id}>
                    <td>
                      <strong>{item.name}</strong>
                      <span>{item.email}</span>
                    </td>
                    <td>
                      <Badge tone={item.role === "admin" ? "success" : "neutral"}>{item.role}</Badge>
                    </td>
                    <td>
                      <Badge tone={item.isActive ? "success" : "danger"}>
                        {item.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td>
                      <strong>{item.phone || "Not set"}</strong>
                      <span>{item.whatsappId ? `WhatsApp: ${item.whatsappId}` : "WhatsApp not set"}</span>
                    </td>
                    <td>
                      <Badge tone={item.telegramId ? "success" : "warning"}>
                        {item.telegramId ? "Connected" : "Missing"}
                      </Badge>
                      <span>{item.telegramId || "Not set"}</span>
                    </td>
                    <td>
                      <strong>{item.plan || "free"}</strong>
                      <Badge tone={item.subscriptionStatus === "free" ? "neutral" : "success"}>
                        {item.subscriptionStatus || "free"}
                      </Badge>
                    </td>
                    <td>
                      <Badge tone={item.notificationsEnabled ? "success" : "muted"}>
                        {item.notificationsEnabled ? "On" : "Off"}
                      </Badge>
                      <span>{formatSchedule(item)}</span>
                    </td>
                    <td>{item.keywordCount || 0}</td>
                    <td>{item.appliedJobCount || 0}</td>
                    <td>{formatDate(item.createdAt)}</td>
                    <td>{formatDate(item.updatedAt)}</td>
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
