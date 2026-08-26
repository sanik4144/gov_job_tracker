import { Bell, RefreshCcw } from "lucide-react";
import { JobList } from "../components/JobList.jsx";
import { JobMetrics } from "../components/JobMetrics.jsx";
import { KeywordPanel } from "../components/KeywordPanel.jsx";
import { StatusMessage } from "../components/StatusMessage.jsx";
import { useDashboard } from "../context/DashboardContext.jsx";

export function JobsPage({ onOpenPdf }) {
  const {
    jobs,
    appliedJobs,
    keywords,
    selectedKeyword,
    newKeyword,
    loading,
    running,
    status,
    setNewKeyword,
    refreshJobs,
    addKeyword,
    removeKeyword,
    selectKeyword,
    toggleApplied,
    runCheck,
  } = useDashboard();

  return (
    <>
      <section className="toolbar">
        <div>
          <h2>Jobs</h2>
          <p>Daily government job alerts from AllJobs by Teletalk</p>
        </div>

        <div className="actions">
          <button
            type="button"
            onClick={() => refreshJobs(selectedKeyword, { showLoader: true })}
            disabled={loading}
            title="Refresh jobs"
          >
            <RefreshCcw size={18} />
            Refresh
          </button>
          <button type="button" onClick={runCheck} disabled={running} title="Run job check">
            <Bell size={18} />
            {running ? "Checking" : "Run Check"}
          </button>
        </div>
      </section>

      <JobMetrics
        totalSaved={jobs.length}
        appliedCount={appliedJobs.length}
        keywordCount={keywords.length}
      />

      <StatusMessage message={status} />

      <KeywordPanel
        keywords={keywords}
        newKeyword={newKeyword}
        selectedKeyword={selectedKeyword}
        onNewKeywordChange={setNewKeyword}
        onAddKeyword={addKeyword}
        onRemoveKeyword={removeKeyword}
        onSelectKeyword={selectKeyword}
      />

      <JobList
        jobs={jobs}
        loading={loading}
        emptyMessage="No saved jobs yet"
        onOpenPdf={onOpenPdf}
        onToggleApplied={toggleApplied}
      />
    </>
  );
}
