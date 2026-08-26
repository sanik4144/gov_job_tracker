import { createContext, useContext, useState } from "react";
import { useAuth } from "./AuthContext.jsx";

const DashboardContext = createContext(null);

export function DashboardProvider({ children }) {
  const { apiFetch } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [appliedJobs, setAppliedJobs] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [selectedKeyword, setSelectedKeyword] = useState("");
  const [newKeyword, setNewKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [busyMessage, setBusyMessage] = useState("");
  const [status, setStatus] = useState("");

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

  async function refreshJobs(keyword = selectedKeyword, { showLoader = false } = {}) {
    if (showLoader) setBusyMessage("Refreshing jobs");

    try {
      await Promise.all([loadJobs(keyword), loadAppliedJobs()]);
    } finally {
      if (showLoader) setBusyMessage("");
    }
  }

  async function addKeyword(event) {
    event.preventDefault();
    const value = newKeyword.trim();
    if (!value) return;

    setBusyMessage("Searching jobs");
    try {
      const data = await apiFetch("/api/keywords", {
        method: "POST",
        body: JSON.stringify({ value }),
      });
      setNewKeyword("");
      setSelectedKeyword(data.keyword.value);
      await loadKeywords();
      await refreshJobs(data.keyword.value);
      setStatus(
        data.search?.error
          ? `Saved keyword: ${data.keyword.value}. Search failed: ${data.search.error}`
          : `Saved keyword: ${data.keyword.value}. Found ${data.search?.found || 0} jobs, new: ${
              data.search?.new || 0
            }.`
      );
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusyMessage("");
    }
  }

  async function removeKeyword(id, value) {
    try {
      await apiFetch(`/api/keywords/${id}`, {
        method: "DELETE",
      });

      const nextSelected = selectedKeyword === value ? "" : selectedKeyword;
      setSelectedKeyword(nextSelected);
      await loadKeywords();
      await refreshJobs(nextSelected);
      setStatus(`Removed keyword: ${value}`);
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
    setBusyMessage("Running job check");
    setStatus("");
    try {
      const data = await apiFetch("/api/run-daily", {
        method: "POST",
        body: JSON.stringify({ notify: true }),
      });
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
      setBusyMessage("");
    }
  }

  function resetDashboard() {
    setJobs([]);
    setAppliedJobs([]);
    setKeywords([]);
    setSelectedKeyword("");
    setNewKeyword("");
    setLoading(false);
    setRunning(false);
    setBusyMessage("");
    setStatus("");
  }

  const value = {
    jobs,
    appliedJobs,
    keywords,
    selectedKeyword,
    newKeyword,
    loading,
    running,
    busyMessage,
    status,
    setNewKeyword,
    setStatus,
    loadKeywords,
    refreshJobs,
    addKeyword,
    removeKeyword,
    selectKeyword,
    toggleApplied,
    runCheck,
    resetDashboard,
  };

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used inside DashboardProvider");
  }
  return context;
}
