import React from "react";
import { 
  Activity, 
  BookOpen, 
  FileCode, 
  LogOut, 
  Shield, 
  Stethoscope, 
  CheckCircle2, 
  Sparkles,
  KeyRound,
  Calendar,
  FolderHeart
} from "lucide-react";
import { User } from "../types";

export type NavTab = "triage" | "booking" | "records" | "rules" | "submission" | "oauth";

interface NavbarProps {
  currentUser: User;
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  activeTab,
  onSelectTab,
  onLogout,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 px-4 lg:px-8 py-2.5 shadow-xs">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Brand & Track Info */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2.5">
            <img 
              src="/carepal-logo.svg" 
              alt="CarePal Triage Logo" 
              className="w-9 h-9 rounded-xl shadow-xs" 
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 tracking-tight text-base">PulseTriage</span>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-50 text-blue-600 border border-blue-100 uppercase tracking-widest">
                  TRACK_ID=PS01
                </span>
              </div>
              <p className="text-[11px] text-slate-500">Patient Intake Triage Assistant &bull; Healthcare Systems</p>
            </div>
          </div>

          <div className="flex md:hidden items-center gap-2">
            <img 
              src={currentUser.avatar} 
              alt={currentUser.name} 
              className="w-7 h-7 rounded-full object-cover border border-slate-300" 
            />
            <button 
              onClick={onLogout}
              className="p-1 text-slate-500 hover:text-red-600"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs w-full md:w-auto overflow-x-auto">
          <button
            id="tab_triage"
            onClick={() => onSelectTab("triage")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer whitespace-nowrap ${
              activeTab === "triage"
                ? "bg-slate-900 text-white shadow-xs font-semibold"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/70"
            }`}
          >
            <Stethoscope className="w-3.5 h-3.5" />
            <span>Intake &amp; Friendly Chat</span>
          </button>

          <button
            id="tab_booking"
            onClick={() => onSelectTab("booking")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer whitespace-nowrap ${
              activeTab === "booking"
                ? "bg-slate-900 text-white shadow-xs font-semibold"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/70"
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-blue-400" />
            <span>Book Doctor Slot</span>
          </button>

          <button
            id="tab_records"
            onClick={() => onSelectTab("records")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer whitespace-nowrap ${
              activeTab === "records"
                ? "bg-slate-900 text-white shadow-xs font-semibold"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/70"
            }`}
          >
            <FolderHeart className="w-3.5 h-3.5 text-pink-400" />
            <span>My Records</span>
          </button>

          <button
            id="tab_rules"
            onClick={() => onSelectTab("rules")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer whitespace-nowrap ${
              activeTab === "rules"
                ? "bg-slate-900 text-white shadow-xs font-semibold"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/70"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Protocols</span>
          </button>

          <button
            id="tab_submission"
            onClick={() => onSelectTab("submission")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer whitespace-nowrap ${
              activeTab === "submission"
                ? "bg-slate-900 text-white shadow-xs font-semibold"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/70"
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Files (app.py)</span>
          </button>

          <button
            id="tab_oauth"
            onClick={() => onSelectTab("oauth")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer whitespace-nowrap ${
              activeTab === "oauth"
                ? "bg-slate-900 text-white shadow-xs font-semibold"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/70"
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>OAuth</span>
          </button>
        </nav>

        {/* Clinical Staff Info & Actions */}
        <div className="hidden md:flex items-center gap-3">
          <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-7 h-7 rounded-full object-cover border border-slate-300"
            />
            <div className="text-left">
              <div className="text-xs font-semibold text-slate-800 leading-tight flex items-center gap-1.5">
                <span>{currentUser.name}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div className="text-[10px] text-blue-600 font-semibold leading-tight">
                {currentUser.role} &bull; {currentUser.station}
              </div>
            </div>
          </div>

          <button
            id="btn_nav_logout"
            onClick={onLogout}
            title="Sign Out of Station"
            className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 border border-slate-200 hover:border-red-200 transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
