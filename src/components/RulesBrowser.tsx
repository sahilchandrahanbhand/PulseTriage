import React, { useState, useEffect } from "react";
import { 
  BookOpen, 
  Search, 
  ShieldAlert, 
  Clock, 
  CheckCircle2, 
  Flame, 
  HeartPulse, 
  Wind, 
  Bandage, 
  Layers,
  FileCheck
} from "lucide-react";
import { ProtocolRule, RulesKnowledgeBase } from "../types";

export const RulesBrowser: React.FC = () => {
  const [data, setData] = useState<RulesKnowledgeBase | null>(null);
  const [selectedFamily, setSelectedFamily] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/rules")
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch((err) => console.error("Failed to load rules:", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-8 text-center text-slate-500">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-medium">Loading published triage protocol knowledge base...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-7xl mx-auto p-8 text-center text-red-600">
        <p>Failed to load knowledge base.</p>
      </div>
    );
  }

  const families = [
    { id: "all", label: "All Walk-In Rules" },
    { id: "chest_pain", label: "Chest Pain" },
    { id: "breathing_difficulty", label: "Breathing Difficulty" },
    { id: "fever", label: "Fever" },
    { id: "injury", label: "Injury / Trauma" },
    { id: "abdominal_pain", label: "Abdominal Pain" },
    { id: "general_escalation", label: "General Escalation" }
  ];

  const filteredRules = data.rules.filter((rule) => {
    const matchesFamily = selectedFamily === "all" || rule.complaint_family === selectedFamily;
    const query = searchQuery.toLowerCase();
    const matchesQuery = 
      !query ||
      rule.rule_id.toLowerCase().includes(query) ||
      rule.title.toLowerCase().includes(query) ||
      rule.citation_text.toLowerCase().includes(query) ||
      rule.department.toLowerCase().includes(query) ||
      rule.triggers.some((t) => t.toLowerCase().includes(query));
    return matchesFamily && matchesQuery;
  });

  return (
    <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-6 text-slate-800">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">{data.name}</h2>
                <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-100 text-blue-600 text-[10px] font-mono font-bold uppercase tracking-wider">
                  {data.track_id}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 max-w-2xl leading-relaxed">
                {data.disclaimer}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative w-full md:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search protocols & triggers..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
              />
            </div>
          </div>
        </div>

        {/* Complaint Family Filter Pills */}
        <div className="flex items-center gap-2 mt-6 overflow-x-auto pb-1 border-t border-slate-100 pt-4">
          {families.map((fam) => (
            <button
              key={fam.id}
              onClick={() => setSelectedFamily(fam.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                selectedFamily === fam.id
                  ? "bg-slate-900 text-white shadow-xs font-semibold"
                  : "bg-slate-50 text-slate-600 border border-slate-200 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              {fam.label}
            </button>
          ))}
        </div>
      </div>

      {/* Rules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredRules.map((rule) => (
          <div
            key={rule.rule_id}
            className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-4 hover:border-blue-300 hover:shadow-md transition"
          >
            <div>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-blue-700 px-2 py-0.5 rounded bg-blue-50 border border-blue-200">
                      {rule.rule_id}
                    </span>
                    <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
                      {rule.complaint_family.replace(/_/g, " ")}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mt-1.5">{rule.title}</h3>
                </div>

                <div className="text-right shrink-0">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide ${
                      rule.urgency_level === 1
                        ? "bg-red-50 text-red-700 border-red-200"
                        : rule.urgency_level === 2
                        ? "bg-rose-50 text-rose-700 border-rose-200"
                        : rule.urgency_level === 3
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-blue-50 text-blue-700 border-blue-200"
                    }`}
                  >
                    Level {rule.urgency_level} &bull; {rule.urgency_name}
                  </span>
                </div>
              </div>

              {/* Department Target */}
              <div className="text-xs text-slate-600 flex items-center gap-1.5 mb-3">
                <span className="text-slate-500">Route to:</span>
                <strong className="text-blue-700 font-semibold">{rule.department}</strong>
              </div>

              {/* Triggers list */}
              <div className="space-y-1.5 mb-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Trigger Conditions:
                </div>
                <ul className="text-xs text-slate-700 space-y-1">
                  {rule.triggers.map((trigger, idx) => (
                    <li key={idx} className="flex items-start gap-1.5 text-[11px]">
                      <span className="text-blue-600 mt-0.5 font-bold">&bull;</span>
                      <span>{trigger}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Citation text */}
              <div className="text-[11px] text-slate-600 leading-relaxed italic border-l-2 border-blue-500 pl-3">
                "{rule.citation_text}"
              </div>
            </div>

            {rule.escalate_to_human && (
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-red-600 pt-2 border-t border-slate-100">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span>Mandatory clinician escalation rule</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
