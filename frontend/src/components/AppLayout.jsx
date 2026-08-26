import { BriefcaseBusiness, ClipboardCheck, LogOut, ShieldCheck, User, Users } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

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
            <BriefcaseBusiness size={18} />
            Jobs
          </NavLink>
          <NavLink to="/applied">
            <ClipboardCheck size={18} />
            Applied Jobs
            <span>{appliedCount}</span>
          </NavLink>
          <NavLink to="/profile">
            <User size={18} />
            Profile
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
          <div>
            <strong>{user?.name || "Account"}</strong>
            <span>{user?.plan || "free"} plan</span>
          </div>
          <button type="button" onClick={onLogout} title="Logout">
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      <div className="content-panel">
        <Outlet />
      </div>
    </main>
  );
}
