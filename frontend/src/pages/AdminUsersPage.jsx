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

      <section className="admin-user-list" aria-busy={loading}>
        {loading ? (
          <div className="empty">Loading users</div>
        ) : users.length === 0 ? (
          <div className="empty">No users found</div>
        ) : (
          users.map((item) => (
            <article className="admin-user-card" key={item._id}>
              <header>
                <div>
                  <h3>{item.name}</h3>
                  <p>{item.email}</p>
                </div>
                <span className={item.role === "admin" ? "role-badge admin" : "role-badge"}>
                  {item.role}
                </span>
              </header>

              <dl>
                <div>
                  <dt>Phone</dt>
                  <dd>{item.phone || "Not set"}</dd>
                </div>
                <div>
                  <dt>Telegram Chat ID</dt>
                  <dd>{item.telegramId || "Not set"}</dd>
                </div>
                <div>
                  <dt>WhatsApp ID</dt>
                  <dd>{item.whatsappId || "Not set"}</dd>
                </div>
                <div>
                  <dt>Plan</dt>
                  <dd>{item.plan || "free"}</dd>
                </div>
                <div>
                  <dt>Subscription</dt>
                  <dd>{item.subscriptionStatus || "free"}</dd>
                </div>
                <div>
                  <dt>Notifications</dt>
                  <dd>{formatSchedule(item)}</dd>
                </div>
                <div>
                  <dt>Keywords</dt>
                  <dd>{item.keywordCount || 0}</dd>
                </div>
                <div>
                  <dt>Applied Jobs</dt>
                  <dd>{item.appliedJobCount || 0}</dd>
                </div>
                <div>
                  <dt>Active</dt>
                  <dd>{item.isActive ? "Yes" : "No"}</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{formatDate(item.createdAt)}</dd>
                </div>
                <div>
                  <dt>Updated</dt>
                  <dd>{formatDate(item.updatedAt)}</dd>
                </div>
              </dl>
            </article>
          ))
        )}
      </section>
    </section>
  );
}
