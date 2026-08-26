import { ExternalLink, X } from "lucide-react";

export function PdfModal({ job, onClose }) {
  if (!job) return null;

  return (
    <div className="pdf-modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="pdf-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pdf-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="pdf-modal-header">
          <div>
            <h2 id="pdf-modal-title">{job.title}</h2>
            <p>{job.organization || "AllJobs by Teletalk"}</p>
          </div>

          <div className="pdf-modal-actions">
            {job.applicationSite && (
              <a href={job.applicationSite} target="_blank" rel="noreferrer">
                <ExternalLink size={18} />
                Apply
              </a>
            )}
            <button type="button" onClick={onClose} title="Close PDF">
              <X size={18} />
            </button>
          </div>
        </header>

        <iframe className="pdf-frame" src={job.advertisementUrl} title={`${job.title} advertisement PDF`} />
      </section>
    </div>
  );
}
