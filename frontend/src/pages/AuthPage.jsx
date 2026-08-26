import { Lock, LogIn, Mail, User, UserPlus } from "lucide-react";
import { useState } from "react";
import { API_BASE_URL } from "../api/client.js";
import { StatusMessage } from "../components/StatusMessage.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export function AuthPage() {
  const { saveAuth } = useAuth();
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [authLoading, setAuthLoading] = useState(false);
  const [status, setStatus] = useState("");

  async function submitAuth(event) {
    event.preventDefault();
    setAuthLoading(true);
    setStatus("");

    try {
      const path = authMode === "register" ? "/api/auth/register" : "/api/auth/login";
      const payload =
        authMode === "register"
          ? authForm
          : { email: authForm.email, password: authForm.password };
      const data = await fetch(`${API_BASE_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then(async (response) => {
        const responseData = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(responseData.message || responseData.error || "Authentication failed");
        }
        return responseData;
      });

      saveAuth(data);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setAuthLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="auth-copy">
          <h1>Gov Job Tracker</h1>
          <p>Sign in to manage your own keywords, saved jobs, and application progress.</p>
        </div>

        <form className="auth-form" onSubmit={submitAuth}>
          <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
            <button
              type="button"
              className={authMode === "login" ? "active" : ""}
              onClick={() => setAuthMode("login")}
            >
              <LogIn size={18} />
              Login
            </button>
            <button
              type="button"
              className={authMode === "register" ? "active" : ""}
              onClick={() => setAuthMode("register")}
            >
              <UserPlus size={18} />
              Register
            </button>
          </div>

          {authMode === "register" && (
            <label>
              <User size={18} />
              <input
                value={authForm.name}
                onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })}
                placeholder="Full name"
                autoComplete="name"
                required
              />
            </label>
          )}

          <label>
            <Mail size={18} />
            <input
              value={authForm.email}
              onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })}
              placeholder="Email address"
              type="email"
              autoComplete="email"
              required
            />
          </label>

          <label>
            <Lock size={18} />
            <input
              value={authForm.password}
              onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
              placeholder="Password"
              type="password"
              autoComplete={authMode === "register" ? "new-password" : "current-password"}
              minLength={6}
              required
            />
          </label>

          <StatusMessage message={status} />

          <button className="auth-submit" type="submit" disabled={authLoading}>
            {authMode === "register" ? <UserPlus size={18} /> : <LogIn size={18} />}
            {authLoading ? "Please wait" : authMode === "register" ? "Create Account" : "Login"}
          </button>
        </form>
      </section>
    </main>
  );
}
