import { useEffect, useState } from "react";
import { Bell, Check, ExternalLink, Plus, RefreshCcw, Search, X } from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const CRON_SECRET = import.meta.env.VITE_CRON_SECRET || "";

export function App() {
  const [jobs, setJobs] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [selectedKeyword, setSelectedKeyword] = useState("");
  const [newKeyword, setNewKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");

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
      await loadJobs(data.keyword.value);
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
      await loadJobs(nextSelected);
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
      setStatus(`Checked ${data.found} jobs for ${data.keywords.length} keywords. New: ${data.new}.`);
      await loadKeywords();
      await loadJobs();
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
        await loadJobs("");
      } catch (error) {
        setStatus(error.message);
        setLoading(false);
      }
    }

    boot();
  }, []);

  return (
    <main className="app-shell">
      <section className="toolbar">
        <div>
          <h1>Gov Job Tracker</h1>
          <p>Daily government job alerts from AllJobs by Teletalk</p>
        </div>

        <div className="actions">
          <button type="button" onClick={() => loadJobs()} disabled={loading} title="Refresh jobs">
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
          <span>Keywords</span>
          <strong>{keywords.length}</strong>
        </div>
        <div>
          <span>Schedule</span>
          <strong>Daily</strong>
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
            <span className={selectedKeyword === keyword.value ? "keyword-chip active" : "keyword-chip"} key={keyword._id}>
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
        ) : jobs.length === 0 ? (
          <div className="empty">
            <Search size={22} />
            No saved jobs yet
          </div>
        ) : (
          jobs.map((job) => (
            <article className={job.applied ? "job-card applied" : "job-card"} key={job._id}>
              <div>
                <h2>{job.title}</h2>
                <p>{job.organization || "AllJobs by Teletalk"}</p>
                {job.deadline && (
                  <span className="deadline">
                    Deadline: {job.deadline}
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
                <button
                  type="button"
                  className={job.applied ? "applied-toggle active" : "applied-toggle"}
                  onClick={() => toggleApplied(job)}
                  title={job.applied ? "Mark not applied" : "Mark applied"}
                >
                  <Check size={18} />
                </button>

                {job.detailUrl && (
                  <a href={job.detailUrl} target="_blank" rel="noreferrer" title="Open job details">
                    <ExternalLink size={18} />
                  </a>
                )}
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
