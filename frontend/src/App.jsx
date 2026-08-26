import { useEffect, useState } from "react";
import {
  Bell,
  BriefcaseBusiness,
  Check,
  ClipboardCheck,
  ExternalLink,
  FileText,
  Lock,
  LogIn,
  LogOut,
  Mail,
  Plus,
  RefreshCcw,
  Search,
  User,
  UserPlus,
  X,
} from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const CRON_SECRET = import.meta.env.VITE_CRON_SECRET || "";
const AUTH_STORAGE_KEY = "gov-job-tracker-auth";

export function App() {
  const [token, setToken] = useState(() => localStorage.getItem(AUTH_STORAGE_KEY) || "");
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [authLoading, setAuthLoading] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [appliedJobs, setAppliedJobs] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [selectedKeyword, setSelectedKeyword] = useState("");
  const [newKeyword, setNewKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");
  const [activeView, setActiveView] = useState("jobs");
  const [pdfJob, setPdfJob] = useState(null);

  const visibleJobs = activeView === "applied" ? appliedJobs : jobs;
  const emptyMessage = activeView === "applied" ? "No applied jobs yet" : "No saved jobs yet";

  async function apiFetch(path, options = {}) {
    const headers = {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    };

    const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      clearAuth();
      throw new Error(data.message || data.error || "Please log in again");
    }

    if (!response.ok) {
      throw new Error(data.message || data.error || "Request failed");
    }

    return data;
  }

  function saveAuth(authData) {
    localStorage.setItem(AUTH_STORAGE_KEY, authData.token);
    setToken(authData.token);
    setUser(authData.user);
    setAuthForm({ name: "", email: "", password: "" });
    setStatus("");
  }

  function clearAuth() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setToken("");
    setUser(null);
    setJobs([]);
    setAppliedJobs([]);
    setKeywords([]);
    setSelectedKeyword("");
    setActiveView("jobs");
    setLoading(false);
  }

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

  async function logout() {
    try {
      if (token) {
        await apiFetch("/api/auth/logout", { method: "POST" });
      }
    } catch (error) {
      setStatus(error.message);
    } finally {
      clearAuth();
    }
  }

  async function loadKeywords() {
    const data = await apiFetch("/api/keywords");
    setKeywords(data.keywords || []);
  }

  async function loadJobs(keyword = selectedKeyword) {
    setLoading(true);
    try {
      const query = keyword ? `?keyword=${encodeURIComponent(keyword)}` : "";
      const data = await apiFetch(`/api/jobs${query}`);
      setJobs(data.jobs || []);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadAppliedJobs() {
    const data = await apiFetch("/api/jobs?applied=true&includeExpired=true");
    setAppliedJobs(data.jobs || []);
  }

  async function refreshJobs(keyword = selectedKeyword) {
    await Promise.all([loadJobs(keyword), loadAppliedJobs()]);
  }

  async function addKeyword(event) {
    event.preventDefault();
    const value = newKeyword.trim();
    if (!value) return;

    try {
      const data = await apiFetch("/api/keywords", {
        method: "POST",
        body: JSON.stringify({ value }),
      });
      setNewKeyword("");
      setSelectedKeyword(data.keyword.value);
      await loadKeywords();
      await refreshJobs(data.keyword.value);
      setStatus(`Saved keyword: ${data.keyword.value}`);
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function removeKeyword(id, value) {
    try {
      const data = await apiFetch(`/api/keywords/${id}`, {
        method: "DELETE",
      });

      const nextSelected = selectedKeyword === value ? "" : selectedKeyword;
      setSelectedKeyword(nextSelected);
      await loadKeywords();
      await refreshJobs(nextSelected);
      setStatus(`Removed ${value}. Deleted ${data.deletedJobs || 0} saved jobs.`);
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function selectKeyword(value) {
    setSelectedKeyword(value);
    await loadJobs(value);
  }

  async function toggleApplied(job) {
    try {
      const data = await apiFetch(`/api/jobs/${job._id}/applied`, {
        method: "PATCH",
        body: JSON.stringify({ applied: !job.applied }),
      });

      setJobs((currentJobs) =>
        currentJobs.map((currentJob) =>
          currentJob._id === job._id
            ? { ...currentJob, applied: data.job.applied, appliedAt: data.job.appliedAt }
            : currentJob
        )
      );
      await loadAppliedJobs();
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function runCheck() {
    setRunning(true);
    setStatus("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/run-daily`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cron-secret": CRON_SECRET,
        },
        body: JSON.stringify({ notify: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Check failed");
      setStatus(
        `Checked ${data.found} jobs for ${data.keywords.length} keywords. New: ${data.new}.` +
          (data.notificationError ? ` Telegram: ${data.notificationError}` : "")
      );
      await loadKeywords();
      await refreshJobs();
    } catch (error) {
      setStatus(error.message);
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    async function boot() {
      try {
        const authData = await apiFetch("/api/auth/me");
        setUser(authData.user);
        await loadKeywords();
        await refreshJobs("");
      } catch (error) {
        setStatus(error.message);
        setLoading(false);
      }
    }

    boot();
  }, [token]);

  if (!token) {
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

            {status && <p className="status">{status}</p>}

            <button className="auth-submit" type="submit" disabled={authLoading}>
              {authMode === "register" ? <UserPlus size={18} /> : <LogIn size={18} />}
              {authLoading ? "Please wait" : authMode === "register" ? "Create Account" : "Login"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <div>
          <h1>Gov Job Tracker</h1>
          <p>Daily government job alerts</p>
        </div>

        <nav className="sidebar-nav">
          <button
            type="button"
            className={activeView === "jobs" ? "active" : ""}
            onClick={() => setActiveView("jobs")}
          >
            <BriefcaseBusiness size={18} />
            Jobs
          </button>
          <button
            type="button"
            className={activeView === "applied" ? "active" : ""}
            onClick={() => setActiveView("applied")}
          >
            <ClipboardCheck size={18} />
            Applied Jobs
            <span>{appliedJobs.length}</span>
          </button>
        </nav>

        <div className="account-panel">
          <div>
            <strong>{user?.name || "Account"}</strong>
            <span>{user?.plan || "free"} plan</span>
          </div>
          <button type="button" onClick={logout} title="Logout">
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      <div className="content-panel">
        <section className="toolbar">
          <div>
            <h2>{activeView === "applied" ? "Applied Jobs" : "Jobs"}</h2>
            <p>
              {activeView === "applied"
                ? "Jobs you have marked with the applied tick"
                : "Daily government job alerts from AllJobs by Teletalk"}
            </p>
          </div>

          <div className="actions">
            <button type="button" onClick={() => refreshJobs()} disabled={loading} title="Refresh jobs">
              <RefreshCcw size={18} />
              Refresh
            </button>
            <button type="button" onClick={runCheck} disabled={running} title="Run job check">
              <Bell size={18} />
              {running ? "Checking" : "Run Check"}
            </button>
          </div>
        </section>

        <section className="metrics">
          <div>
            <span>Total saved</span>
            <strong>{jobs.length}</strong>
          </div>
          <div>
            <span>Applied</span>
            <strong>{appliedJobs.length}</strong>
          </div>
          <div>
            <span>Keywords</span>
            <strong>{keywords.length}</strong>
          </div>
        </section>

        {status && <p className="status">{status}</p>}

        <section className="keyword-panel">
          <form onSubmit={addKeyword}>
            <Search size={18} />
            <input
              value={newKeyword}
              onChange={(event) => setNewKeyword(event.target.value)}
              placeholder="Add a job title keyword"
            />
            <button type="submit" title="Add keyword">
              <Plus size={18} />
              Add
            </button>
          </form>

          <div className="keyword-chips">
            <button
              type="button"
              className={!selectedKeyword ? "active" : ""}
              onClick={() => selectKeyword("")}
            >
              All
            </button>

            {keywords.map((keyword) => (
              <span
                className={selectedKeyword === keyword.value ? "keyword-chip active" : "keyword-chip"}
                key={keyword._id}
              >
                <button type="button" onClick={() => selectKeyword(keyword.value)}>
                  {keyword.value}
                </button>
                <button
                  type="button"
                  onClick={() => removeKeyword(keyword._id, keyword.value)}
                  title={`Remove ${keyword.value}`}
                >
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
        </section>

        <section className="job-list" aria-busy={loading}>
          {loading ? (
            <div className="empty">
              <Search size={22} />
              Loading jobs
            </div>
          ) : visibleJobs.length === 0 ? (
            <div className="empty">
              <Search size={22} />
              {emptyMessage}
            </div>
          ) : (
            visibleJobs.map((job) => (
              <article className={job.applied ? "job-card applied" : "job-card"} key={job._id}>
                <div>
                  <h2>{job.title}</h2>
                  <p>{job.organization || "AllJobs by Teletalk"}</p>
                  {job.deadline && (
                    <span className={job.isExpired ? "deadline expired" : "deadline"}>
                      Deadline: {job.deadline}
                      {job.isExpired && <span className="expired-label">Expired</span>}
                      {job.isDueSoon && <span className="deadline-dot" aria-label="Deadline in 2 days" />}
                    </span>
                  )}
                  {job.keywords?.length > 0 && (
                    <div className="job-tags">
                      {job.keywords.map((keyword) => (
                        <span key={keyword}>{keyword}</span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="job-actions">
                  {job.advertisementUrl && (
                    <button
                      type="button"
                      className="pdf-toggle"
                      onClick={() => setPdfJob(job)}
                      title="Open advertisement PDF"
                    >
                      <FileText size={18} />
                    </button>
                  )}

                  {job.detailUrl && (
                    <a href={job.detailUrl} target="_blank" rel="noreferrer" title="Open job details">
                      <ExternalLink size={18} />
                    </a>
                  )}

                  <button
                    type="button"
                    className={job.applied ? "applied-toggle active" : "applied-toggle"}
                    onClick={() => toggleApplied(job)}
                    title={job.applied ? "Mark not applied" : "Mark applied"}
                  >
                    <Check size={18} />
                  </button>
                </div>
              </article>
            ))
          )}
        </section>
      </div>

      {pdfJob && (
        <div className="pdf-modal-backdrop" role="presentation" onClick={() => setPdfJob(null)}>
          <section
            className="pdf-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pdf-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="pdf-modal-header">
              <div>
                <h2 id="pdf-modal-title">{pdfJob.title}</h2>
                <p>{pdfJob.organization || "AllJobs by Teletalk"}</p>
              </div>

              <div className="pdf-modal-actions">
                {pdfJob.applicationSite && (
                  <a href={pdfJob.applicationSite} target="_blank" rel="noreferrer">
                    <ExternalLink size={18} />
                    Apply
                  </a>
                )}
                <button type="button" onClick={() => setPdfJob(null)} title="Close PDF">
                  <X size={18} />
                </button>
              </div>
            </header>

            <iframe
              className="pdf-frame"
              src={pdfJob.advertisementUrl}
              title={`${pdfJob.title} advertisement PDF`}
            />
          </section>
        </div>
      )}
    </main>
  );
}
