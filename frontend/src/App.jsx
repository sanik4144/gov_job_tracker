import { useEffect, useState } from "react";
import {
  Bell,
  BriefcaseBusiness,
  Check,
  ClipboardCheck,
  ExternalLink,
  FileText,
  Plus,
  RefreshCcw,
  Search,
  X,
} from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const CRON_SECRET = import.meta.env.VITE_CRON_SECRET || "";

export function App() {
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

  async function loadKeywords() {
    const response = await fetch(`${API_BASE_URL}/api/keywords`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load keywords");
    setKeywords(data.keywords || []);
  }

  async function loadJobs(keyword = selectedKeyword) {
    setLoading(true);
    try {
      const query = keyword ? `?keyword=${encodeURIComponent(keyword)}` : "";
      const response = await fetch(`${API_BASE_URL}/api/jobs${query}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load jobs");
      setJobs(data.jobs || []);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadAppliedJobs() {
    const response = await fetch(`${API_BASE_URL}/api/jobs?applied=true&includeExpired=true`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load applied jobs");
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
      const response = await fetch(`${API_BASE_URL}/api/keywords`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save keyword");
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
      const response = await fetch(`${API_BASE_URL}/api/keywords/${id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not remove keyword");

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
      const response = await fetch(`${API_BASE_URL}/api/jobs/${job._id}/applied`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applied: !job.applied }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update applied status");

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
    async function boot() {
      try {
        await loadKeywords();
        await refreshJobs("");
      } catch (error) {
        setStatus(error.message);
        setLoading(false);
      }
    }

    boot();
  }, []);

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
