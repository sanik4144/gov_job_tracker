import { useEffect, useState } from "react";
import { Bell, ExternalLink, RefreshCcw, Search } from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const CRON_SECRET = import.meta.env.VITE_CRON_SECRET || "";

export function App() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");

  async function loadJobs() {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/jobs`);
      const data = await response.json();
      setJobs(data.jobs || []);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setLoading(false);
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
      setStatus(`Checked ${data.found} jobs. New: ${data.new}.`);
      await loadJobs();
    } catch (error) {
      setStatus(error.message);
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    loadJobs();
  }, []);

  return (
    <main className="app-shell">
      <section className="toolbar">
        <div>
          <h1>Gov Job Tracker</h1>
          <p>Assistant Programmer alerts from AllJobs by Teletalk</p>
        </div>

        <div className="actions">
          <button type="button" onClick={loadJobs} disabled={loading} title="Refresh jobs">
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
          <span>Keyword</span>
          <strong>Assistant Programmer</strong>
        </div>
        <div>
          <span>Schedule</span>
          <strong>Daily</strong>
        </div>
      </section>

      {status && <p className="status">{status}</p>}

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
            <article className="job-card" key={job._id}>
              <div>
                <h2>{job.title}</h2>
                <p>{job.organization || "AllJobs by Teletalk"}</p>
                {job.deadline && <span>Deadline: {job.deadline}</span>}
              </div>

              {job.detailUrl && (
                <a href={job.detailUrl} target="_blank" rel="noreferrer" title="Open job details">
                  <ExternalLink size={18} />
                </a>
              )}
            </article>
          ))
        )}
      </section>
    </main>
  );
}
