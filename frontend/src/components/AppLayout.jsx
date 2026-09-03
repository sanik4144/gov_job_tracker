import { Check, LogOut, ShieldCheck, User, Users } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { ThemeToggle } from "./ThemeToggle.jsx";

export function AppLayout({ appliedCount, onLogout }) {
  const { user } = useAuth();

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <div>
          <h1>Gov Job Tracker</h1>
          <p>Daily government job alerts</p>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/jobs">
            <span className="live-dot" aria-hidden="true" />
            Jobs
          </NavLink>
          <NavLink to="/applied">
            <Check size={18} />
            Applied Jobs
            <span className="nav-count">{appliedCount}</span>
          </NavLink>
        </nav>

        {user?.role === "admin" && (
          <nav className="sidebar-nav admin-nav" aria-label="Admin navigation">
            <div className="sidebar-section-title">
              <ShieldCheck size={16} />
              Admin
            </div>
            <NavLink to="/admin/users">
              <Users size={18} />
              Users
            </NavLink>
          </nav>
        )}

        <div className="account-panel">
          <NavLink to="/profile" className="account-summary">
            <span className="account-avatar" aria-hidden="true">
              {(user?.name || "A").trim().charAt(0).toUpperCase()}
            </span>
            <span className="account-meta">
              <strong>{user?.name || "Account"}</strong>
              <span>{user?.plan || "free"} plan</span>
            </span>
          </NavLink>

          <div className="account-actions">
            <ThemeToggle className="icon-toggle" iconOnly />
            <button type="button" className="icon-toggle" onClick={onLogout} title="Logout">
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>

      <div className="content-panel">
        <Outlet />
      </div>
    </main>
  );
}
