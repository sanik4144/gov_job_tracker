import { Check, ExternalLink, FileText, Search } from "lucide-react";

function formatMatchRef(job) {
  const seenAt = job.firstSeenAt || job.notifiedAt;
  if (!seenAt) return null;

  const parsed = new Date(seenAt);
  if (Number.isNaN(parsed.getTime())) return null;

  const time = parsed.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  return `MATCH · ${time}`;
}

function getDeadlineBadge(job) {
  if (!job.deadline) return null;

  if (job.isExpired) {
    return { text: "Expired", tone: "critical" };
  }

  if (job.daysUntilDeadline === 0) {
    return { text: "Due today", tone: "critical" };
  }

  if (job.isDueSoon && typeof job.daysUntilDeadline === "number") {
    return { text: `T-${job.daysUntilDeadline * 24}H`, tone: "warn" };
  }

  if (typeof job.daysUntilDeadline === "number") {
    return { text: `T-${job.daysUntilDeadline}D`, tone: "neutral" };
  }

  return { text: job.deadline, tone: "neutral" };
}

export function JobList({ jobs, loading, emptyMessage, onOpenPdf, onToggleApplied }) {
  return (
    <section className="job-list" aria-busy={loading}>
      {loading ? (
        <div className="empty">
          <Search size={22} />
          Loading jobs
        </div>
      ) : jobs.length === 0 ? (
        <div className="empty">
          <Search size={22} />
          {emptyMessage}
        </div>
      ) : (
        jobs.map((job) => {
          const matchRef = formatMatchRef(job);
          const badge = getDeadlineBadge(job);

          return (
            <article className={job.applied ? "job-card applied" : "job-card"} key={job._id}>
              <div>
                {matchRef && <span className="job-ref">{matchRef}</span>}
                <h2>{job.title}</h2>
                <p>{job.organization || "AllJobs by Teletalk"}</p>
                {badge && (
                  <span className={`deadline-badge ${badge.tone}`} title={`Deadline: ${job.deadline}`}>
                    {badge.text}
                  </span>
                )}
              </div>

              <div className="job-actions">
                {job.advertisementUrl && (
                  <button
                    type="button"
                    className="pdf-toggle"
                    onClick={() => onOpenPdf(job)}
                    title="Open advertisement PDF"
                  >
                    <FileText size={15} />
                  </button>
                )}

                {job.detailUrl && (
                  <a href={job.detailUrl} target="_blank" rel="noreferrer" title="Open job details">
                    <ExternalLink size={15} />
                  </a>
                )}

                <button
                  type="button"
                  className={job.applied ? "applied-toggle active" : "applied-toggle"}
                  onClick={() => onToggleApplied(job)}
                  title={job.applied ? "Mark not applied" : "Mark applied"}
                >
                  <Check size={15} />
                </button>
              </div>
            </article>
          );
        })
      )}
    </section>
  );
}
