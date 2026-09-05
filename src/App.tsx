import React, { useState, useEffect } from "react";
import { User, TriageResult, ChecklistItem } from "./types";
import { LoginPage } from "./components/LoginPage";
import { Navbar, NavTab } from "./components/Navbar";
import { TriageAssistant } from "./components/TriageAssistant";
import { RulesBrowser } from "./components/RulesBrowser";
import { SubmissionPackageViewer } from "./components/SubmissionPackageViewer";
import { OAuthSecurityPanel } from "./components/OAuthSecurityPanel";
import { DoctorBookingView } from "./components/DoctorBookingView";
import { PatientRecordsView } from "./components/PatientRecordsView";
import { DEFAULT_CHECKLIST_ITEMS } from "./components/PatientChecklist";

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<NavTab>("triage");
  const [latestTriageResult, setLatestTriageResult] = useState<TriageResult | null>(null);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>(DEFAULT_CHECKLIST_ITEMS);

  useEffect(() => {
    // Check local storage or existing session
    const savedToken = localStorage.getItem("tiq_session_token");
    const savedUser = localStorage.getItem("tiq_session_user");

    if (savedToken && savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
        setToken(savedToken);
      } catch (e) {
        localStorage.removeItem("tiq_session_token");
        localStorage.removeItem("tiq_session_user");
      }
    }

    // Check with server
    fetch("/api/auth/session", {
      headers: savedToken ? { Authorization: `Bearer ${savedToken}` } : {},
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated && data.user) {
          setCurrentUser(data.user);
          setToken(data.token || savedToken);
        }
      })
      .catch((err) => console.log("Session check error (offline fallback ok):", err))
      .finally(() => setLoading(false));
  }, []);

  const handleLoginSuccess = (user: User, authToken: string) => {
    setCurrentUser(user);
    setToken(authToken);
    localStorage.setItem("tiq_session_token", authToken);
    localStorage.setItem("tiq_session_user", JSON.stringify(user));
  };

  const handleLogout = async () => {
    if (token) {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (e) {}
    }
    localStorage.removeItem("tiq_session_token");
    localStorage.removeItem("tiq_session_user");
    setCurrentUser(null);
    setToken(null);
    setActiveTab("triage");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-blue-600">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs tracking-wider uppercase font-semibold text-slate-600">
            Initializing Clinical Intake Assistant...
          </span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div id="app_root" className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-blue-600 selection:text-white font-sans">
      <Navbar
        currentUser={currentUser}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onLogout={handleLogout}
      />

      <main className="flex-1 pb-12">
        {activeTab === "triage" && (
          <TriageAssistant 
            currentUser={currentUser}
            onNavigateTab={setActiveTab}
            onSetTriageResult={setLatestTriageResult}
            sharedChecklist={checklistItems}
            onChecklistChange={setChecklistItems}
          />
        )}
        {activeTab === "booking" && (
          <DoctorBookingView
            currentUser={currentUser}
            triageResult={latestTriageResult}
            checklistItems={checklistItems}
            onBookingSuccess={() => setActiveTab("records")}
            onViewRecords={() => setActiveTab("records")}
          />
        )}
        {activeTab === "records" && (
          <PatientRecordsView
            currentUser={currentUser}
            onBookNewSlot={() => setActiveTab("booking")}
          />
        )}
        {activeTab === "rules" && <RulesBrowser />}
        {activeTab === "submission" && <SubmissionPackageViewer />}
        {activeTab === "oauth" && <OAuthSecurityPanel currentUser={currentUser} />}
      </main>
    </div>
  );
}
