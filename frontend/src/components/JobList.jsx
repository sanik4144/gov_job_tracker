import { Check, ExternalLink, FileText, Search } from "lucide-react";

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
        jobs.map((job) => (
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
                  onClick={() => onOpenPdf(job)}
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
                onClick={() => onToggleApplied(job)}
                title={job.applied ? "Mark not applied" : "Mark applied"}
              >
                <Check size={18} />
              </button>
            </div>
          </article>
        ))
      )}
    </section>
  );
}
