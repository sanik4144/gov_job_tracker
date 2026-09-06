import { Bell, RefreshCcw } from "lucide-react";
import { JobList } from "../components/JobList.jsx";
import { PlanLimitNotice } from "../components/PlanLimitNotice.jsx";
import { JobMetrics } from "../components/JobMetrics.jsx";
import { KeywordPanel } from "../components/KeywordPanel.jsx";
import { StatusMessage } from "../components/StatusMessage.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useDashboard } from "../context/DashboardContext.jsx";
import { describeLimit, isUnlimited } from "../utils/plan.js";

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
    planLimit,
    setPlanLimit,
  } = useDashboard();
  const { entitlements } = useAuth();
  const keywordLimit = entitlements.limits.keywords;
  // Never gate on the placeholder entitlements, or the control flashes disabled on
  // every page load before /me answers.
  const atKeywordLimit =
    entitlements.isResolved && !isUnlimited(keywordLimit) && keywords.length >= keywordLimit;

  return (
    <>
      <section className="toolbar">
        <div>
          <h2>Active Jobs</h2>
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
            Sync
          </button>
          <button type="button" onClick={runCheck} disabled={running} title="Run job check">
            <Bell size={18} />
            {running ? "Scanning" : "Run Scan"}
          </button>
        </div>
      </section>

      <JobMetrics
        totalSaved={jobs.length}
        appliedCount={appliedJobs.length}
        keywordCount={keywords.length}
      />

      <StatusMessage message={status} />
      <PlanLimitNotice limit={planLimit} onDismiss={() => setPlanLimit(null)} />

      <KeywordPanel
        usage={
          entitlements.isResolved ? `${keywords.length} / ${describeLimit(keywordLimit)}` : ""
        }
        atLimit={atKeywordLimit}
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
