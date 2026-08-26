import { BriefcaseBusiness, ClipboardCheck, LogOut, User } from "lucide-react";
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
