import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { AppLayout } from "./components/AppLayout.jsx";
import { LoaderPopup } from "./components/LoaderPopup.jsx";
import { PdfModal } from "./components/PdfModal.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import { DashboardProvider, useDashboard } from "./context/DashboardContext.jsx";
import { AdminPaymentsPage } from "./pages/AdminPaymentsPage.jsx";
import { AdminUsersPage } from "./pages/AdminUsersPage.jsx";
import { AppliedJobsPage } from "./pages/AppliedJobsPage.jsx";
import { AuthPage } from "./pages/AuthPage.jsx";
import { BillingPage } from "./pages/BillingPage.jsx";
import { JobsPage } from "./pages/JobsPage.jsx";
import { ProfilePage } from "./pages/ProfilePage.jsx";

export function App() {
  const { token } = useAuth();

  if (!token) {
    return <AuthPage />;
  }

  return (
    <DashboardProvider>
      <ProtectedApp />
    </DashboardProvider>
  );
}

function ProtectedApp() {
  const navigate = useNavigate();
  const { apiFetch, clearAuth, setUser, syncProfileForm } = useAuth();
  const { appliedJobs, busyMessage, loadKeywords, refreshJobs, resetDashboard, setStatus } =
    useDashboard();
  const [pdfJob, setPdfJob] = useState(null);

  async function logout() {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch (error) {
      setStatus(error.message);
    } finally {
      resetDashboard();
      clearAuth();
      navigate("/jobs", { replace: true });
    }
  }

  useEffect(() => {
    async function boot() {
      try {
        const authData = await apiFetch("/api/auth/me");
        setUser(authData.user);
        syncProfileForm(authData.user);
        await loadKeywords();
        await refreshJobs("");
      } catch (error) {
        setStatus(error.message);
      }
    }

    boot();
  }, []);

  return (
    <>
      <Routes>
        <Route element={<AppLayout appliedCount={appliedJobs.length} onLogout={logout} />}>
          <Route index element={<Navigate to="/jobs" replace />} />
          <Route path="jobs" element={<JobsPage onOpenPdf={setPdfJob} />} />
          <Route path="applied" element={<AppliedJobsPage onOpenPdf={setPdfJob} />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="billing" element={<BillingPage />} />
          <Route path="admin/users" element={<AdminUsersPage />} />
          <Route path="admin/payments" element={<AdminPaymentsPage />} />
          <Route path="*" element={<Navigate to="/jobs" replace />} />
        </Route>
      </Routes>

      <LoaderPopup message={busyMessage} />
      <PdfModal job={pdfJob} onClose={() => setPdfJob(null)} />
    </>
  );
}
