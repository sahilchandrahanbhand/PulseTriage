import React, { useState } from "react";
import { 
  AlertTriangle, 
  Send, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  ShieldAlert, 
  Copy, 
  Check, 
  HelpCircle, 
  RotateCcw, 
  UserCheck, 
  ArrowRight,
  Flame,
  HeartPulse,
  Wind,
  Bandage,
  Activity,
  Layers,
  FileText,
  Stethoscope,
  Download,
  Printer,
  Code2,
  ChevronDown,
  ChevronUp,
  Calendar,
  MessageCircleHeart,
  CheckSquare
} from "lucide-react";
import { TriageResult, User, ChecklistItem } from "../types";
import { NavTab } from "./Navbar";
import { FriendlyCompanionChat } from "./FriendlyCompanionChat";
import { PatientChecklist, DEFAULT_CHECKLIST_ITEMS } from "./PatientChecklist";

interface TriageAssistantProps {
  currentUser: User;
  onNavigateTab?: (tab: NavTab) => void;
  onSetTriageResult?: (result: TriageResult) => void;
  sharedChecklist?: ChecklistItem[];
  onChecklistChange?: (items: ChecklistItem[]) => void;
}

const PRESET_SCENARIOS = [
  {
    id: "normal_fever",
    label: "Case 1: Ordinary Fever Path",
    description: "Fever since yesterday in alert adult, mild cold symptoms",
    family: "Fever",
    expectedRule: "R-FEVER-03",
    expectedUrgency: "Level 4 (Less Urgent)",
    text: "I've had a fever since yesterday around 38.3°C and feel wiped out, throat is a bit scratchy. I'm drinking water fine and haven't thrown up.",
    answers: { stiff_neck: false, petechial_rash: false, dehydration_or_vomiting: false, patient_age_neonate: false }
  },
  {
    id: "redflag_chest",
    label: "Case 2: High-Risk Chest Pain Path",
    description: "Crushing chest tightness with diaphoresis & arm radiation",
    family: "Chest Pain",
    expectedRule: "R-CHEST-01",
    expectedUrgency: "Level 1 (Immediate)",
    text: "My chest feels tight like an elephant is sitting on it. I broke out in a cold sweat, feeling nauseous, and the ache is radiating down my left arm.",
    answers: { diaphoresis: true, radiation_arm_jaw: true, crushing_pressure: true, shortness_of_breath: true }
  },
  {
    id: "severe_dyspnea",
    label: "Case 3: Critical Respiratory Compromise",
    description: "Severe breathlessness, audible stridor, cannot speak",
    family: "Breathing",
    expectedRule: "R-BREATH-01",
    expectedUrgency: "Level 1 (Immediate)",
    text: "Can't breathe... wheezing loudly... gasping for air... can't finish words... lips look bluish.",
    answers: { cyanosis: true, stridor: true, unable_to_speak_sentences: true }
  },
  {
    id: "trauma_ottawa",
    label: "Case 4: Extremity Trauma (Ottawa Positive)",
    description: "Twisted ankle, severe swelling, inability to bear weight",
    family: "Injury",
    expectedRule: "R-INJURY-02",
    expectedUrgency: "Level 3 (Urgent)",
    text: "I twisted my right ankle playing pickup basketball. Heard a pop, it swelled up immediately, and I cannot bear any weight to walk 4 steps.",
    answers: { cannot_bear_weight: true, high_energy_trauma: false, active_bleeding: false }
  },
  {
    id: "acute_abdomen",
    label: "Case 5: Rigid Surgical Abdomen",
    description: "Excruciating belly pain, board-like rigidity, syncope",
    family: "Abdomen",
    expectedRule: "R-ABDOM-01",
    expectedUrgency: "Level 1 (Immediate)",
    text: "Sudden agonizing belly pain that started 2 hours ago. My stomach feels rock hard and rigid like a board, and I felt faint when standing up.",
    answers: { rigid_abdomen: true, syncope: true }
  },
  {
    id: "neonatal_fever",
    label: "Case 6: High-Risk Neonatal Fever",
    description: "6-week-old infant with high fever (Sepsis Screen)",
    family: "Pediatric",
    expectedRule: "R-FEVER-01",
    expectedUrgency: "Level 2 (Emergent)",
    text: "My 6-week-old newborn baby has a fever of 38.6°C, is lethargic, and refusing to feed.",
    answers: { age_months: 1.5, age_years: 0, stiff_neck: false }
  }
];

export const TriageAssistant: React.FC<TriageAssistantProps> = ({ 
  currentUser,
  onNavigateTab,
  onSetTriageResult,
  sharedChecklist = DEFAULT_CHECKLIST_ITEMS,
  onChecklistChange
}) => {
  const [subMode, setSubMode] = useState<"intake" | "chat" | "checklist">(
    currentUser.accountType === "patient" || currentUser.role === "Patient" ? "chat" : "intake"
  );
  const [checklist, setChecklist] = useState<ChecklistItem[]>(sharedChecklist);
  const [patientText, setPatientText] = useState("");
  const [followUpAnswers, setFollowUpAnswers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TriageResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [escalationAcknowledged, setEscalationAcknowledged] = useState(false);
  const [showRawFacts, setShowRawFacts] = useState(false);

  const handleChecklistChange = (newItems: ChecklistItem[]) => {
    setChecklist(newItems);
    onChecklistChange?.(newItems);
  };

  const runAssessment = async (text: string, answers: Record<string, any>) => {
    if (!text || text.trim().length < 3) {
      setError("Please enter a patient description with at least 3 characters.");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/triage/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_description: text,
          follow_up_answers: answers
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to process triage analysis");
      }

      const data: TriageResult = await response.json();
      setResult(data);
      onSetTriageResult?.(data);
      setEscalationAcknowledged(false);

      // Auto-store intake in persistent database
      try {
        await fetch("/api/intake/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientId: currentUser.id,
            patientName: currentUser.name,
            patientEmail: currentUser.email,
            patientPhone: currentUser.phone || "",
            patientDescription: text,
            checklistSummary: checklist.filter((i) => i.checked).map((i) => i.label),
            triageNote: data.triage_note,
            evaluatedBy: `${currentUser.name} (${currentUser.role})`
          })
        });
      } catch (saveErr) {
        console.warn("Auto-save intake error (non-fatal):", saveErr);
      }
    } catch (err: any) {
      console.error("Triage analysis failed:", err);
      setError(err.message || "Triage processing failed. Please check network.");
    } finally {
      setLoading(false);
    }
  };

  const handleApplyScenario = (scenario: typeof PRESET_SCENARIOS[0]) => {
    setPatientText(scenario.text);
    setFollowUpAnswers(scenario.answers);
    runAssessment(scenario.text, scenario.answers);
  };

  const handleFollowUpAnswer = (field: string, value: boolean) => {
    const updated = { ...followUpAnswers, [field]: value };
    setFollowUpAnswers(updated);
    runAssessment(patientText, updated);
  };

  const handleClearFollowUps = () => {
    setFollowUpAnswers({});
    if (patientText.trim()) {
      runAssessment(patientText, {});
    }
  };

  const handleReset = () => {
    setPatientText("");
    setFollowUpAnswers({});
    setResult(null);
    setError(null);
    setEscalationAcknowledged(false);
    setShowRawFacts(false);
  };

  const generateNoteText = () => {
    if (!result) return "";
    const note = result.triage_note;
    return `========================================================
PATIENT INTAKE TRIAGE NOTE (TRACK_ID=PS01)
========================================================
Evaluator: ${currentUser.name} (${currentUser.role} - ${currentUser.station})
Timestamp: ${new Date().toISOString()}

RECOMMENDED URGENCY: Level ${note.urgency_level} - ${note.urgency_name}
TARGET DEPARTMENT:   ${note.department}
ESCALATE TO HUMAN:   ${note.escalate_to_human ? "YES (MANDATORY IMMEDIATE BEDSIDE CLINICAL HANDOFF)" : "NO (Standard queue routing)"}
PROTOCOL CITED:      ${note.rule_id}

PROTOCOL CITATION & RATIONALE:
${note.citation_text}

1. WHAT PATIENT REPORTED:
${note.what_patient_reported.map(item => ` - ${item}`).join("\n")}

2. WHAT FOLLOW-UPS ESTABLISHED:
${note.what_followups_established.length > 0 ? note.what_followups_established.map(item => ` - ${item}`).join("\n") : " - None recorded"}

3. WHAT REMAINS UNKNOWN:
${note.what_remains_unknown.length > 0 ? note.what_remains_unknown.map(item => ` - ${item}`).join("\n") : " - All standard high-risk screens confirmed"}

CLINICAL DISCLAIMER:
${note.disclaimer}
========================================================`;
  };

  const copyTriageNote = () => {
    const text = generateNoteText();
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadTriageNote = () => {
    const text = generateNoteText();
    if (!text) return;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Triage_Note_PS01_${result?.triage_note.rule_id || "Report"}_${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2500);
  };

  const printTriageNote = () => {
    window.print();
  };

  const handleAcknowledgeEscalation = () => {
    setEscalationAcknowledged(true);
  };

  const getUrgencyBadge = (level: number) => {
    switch (level) {
      case 1:
        return {
          bg: "bg-red-50 border-red-200 text-red-800",
          tag: "LEVEL 1: IMMEDIATE (RESUSCITATION)",
          wait: "0 min - Immediate Bedside Doctor Allocation",
          icon: <ShieldAlert className="w-5 h-5 text-red-600 animate-pulse" />
        };
      case 2:
        return {
          bg: "bg-rose-50 border-rose-200 text-rose-800",
          tag: "LEVEL 2: EMERGENT",
          wait: "Target <= 15 minutes",
          icon: <AlertTriangle className="w-5 h-5 text-rose-600" />
        };
      case 3:
        return {
          bg: "bg-amber-50 border-amber-200 text-amber-800",
          tag: "LEVEL 3: URGENT",
          wait: "Target <= 60 minutes",
          icon: <Clock className="w-5 h-5 text-amber-600" />
        };
      case 4:
        return {
          bg: "bg-blue-50 border-blue-200 text-blue-800",
          tag: "LEVEL 4: LESS URGENT",
          wait: "Target <= 120 minutes",
          icon: <CheckCircle2 className="w-5 h-5 text-blue-600" />
        };
      case 5:
      default:
        return {
          bg: "bg-emerald-50 border-emerald-200 text-emerald-800",
          tag: "LEVEL 5: NON-URGENT",
          wait: "Target <= 240 minutes",
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />
        };
    }
  };

  return (
    <div id="triage_assistant_container" className="max-w-7xl mx-auto p-4 lg:p-8 space-y-6 text-slate-800">
      {/* Clinician Active Station Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">Walk-In Patient Intake &amp; Triage Assessment</h2>
              <span className="bg-green-100 border border-green-200 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 uppercase tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping" />
                Deterministic Rules Active
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Logged in as <strong className="text-slate-800">{currentUser.name}</strong> &bull; {currentUser.role} ({currentUser.station})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto text-xs">
          <button
            id="btn_reset_triage"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer font-medium"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>New Patient</span>
          </button>
        </div>
      </div>

      {/* Sub-Mode Navigation Toolbar: Clinical Intake, Friendly Companion Chat, Patient Checklist */}
      <div className="bg-white border border-slate-200 rounded-2xl p-2 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
          <button
            type="button"
            id="subtab_intake"
            onClick={() => setSubMode("intake")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition cursor-pointer ${
              subMode === "intake"
                ? "bg-white text-slate-900 shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Stethoscope className="w-3.5 h-3.5 text-blue-600" />
            <span>Clinical Intake &amp; Protocols</span>
          </button>

          <button
            type="button"
            id="subtab_chat"
            onClick={() => setSubMode("chat")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition cursor-pointer ${
              subMode === "chat"
                ? "bg-white text-slate-900 shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <MessageCircleHeart className="w-3.5 h-3.5 text-pink-500" />
            <span>CarePal Friendly Chat</span>
          </button>

          <button
            type="button"
            id="subtab_checklist"
            onClick={() => setSubMode("checklist")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition cursor-pointer ${
              subMode === "checklist"
                ? "bg-white text-slate-900 shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
            <span>Patient Checklist</span>
          </button>
        </div>

        <div className="flex items-center gap-2 px-1">
          {onNavigateTab && (
            <button
              type="button"
              id="btn_toolbar_book_doctor"
              onClick={() => onNavigateTab("booking")}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Book Doctor Slot</span>
            </button>
          )}
        </div>
      </div>

      {subMode === "chat" && (
        <FriendlyCompanionChat
          currentUser={currentUser}
          checklistItems={checklist}
          onAddChecklistItem={(label) => {
            const newItem: ChecklistItem = {
              id: `custom-${Date.now()}`,
              category: "custom",
              label,
              checked: true,
              severity: "moderate"
            };
            handleChecklistChange([...checklist, newItem]);
          }}
          onRequestTriageAnalysis={(text) => {
            setPatientText(text);
            runAssessment(text, followUpAnswers);
            setSubMode("intake");
          }}
          onOpenBooking={() => onNavigateTab?.("booking")}
          isAnalyzingTriage={loading}
        />
      )}

      {subMode === "checklist" && (
        <PatientChecklist
          items={checklist}
          onItemsChange={handleChecklistChange}
          onApplyToTriage={(summaryText) => {
            setPatientText(summaryText);
            runAssessment(summaryText, followUpAnswers);
            setSubMode("intake");
          }}
        />
      )}

      {subMode === "intake" && (
        <>
          {/* 1-Click Evaluation Preset Scenarios for Hackathon Judges */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            <span>Evaluation Test Scenarios (1-Click Judge Walkthrough)</span>
          </div>
          <span className="text-[11px] text-slate-400">Criteria: Normal Case vs Difficult/Red-Flag Case</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {PRESET_SCENARIOS.map((scenario) => (
            <button
              key={scenario.id}
              id={`preset_${scenario.id}`}
              onClick={() => handleApplyScenario(scenario)}
              className="text-left p-3 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-blue-500 hover:bg-blue-50/40 transition group cursor-pointer"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-800 group-hover:text-blue-700 transition">
                  {scenario.label}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600 font-mono font-semibold">
                  {scenario.expectedRule}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 line-clamp-1">{scenario.description}</p>
              <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                <span className="text-blue-600 font-semibold">{scenario.family}</span>
                <span className="text-slate-600 font-medium">{scenario.expectedUrgency}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Two Column Layout: Intake Input & Triage Output Note */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Intake Input Form (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div>
              <label htmlFor="patient_description_input" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>Patient Plain-Language Presentation</span>
              </label>
              <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
                Enter the patient or clerk's raw description. The assistant extracts objective clinical facts and prompts follow-ups for missing high-risk screens.
              </p>
              <textarea
                id="patient_description_input"
                rows={5}
                value={patientText}
                onChange={(e) => setPatientText(e.target.value)}
                placeholder="Example: 'I've had a fever since yesterday and my neck feels a bit stiff, also feel lightheaded...' or 'My chest feels heavy and I'm sweating bullets...'"
                className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl p-3.5 text-xs text-slate-800 placeholder-slate-400 resize-none transition font-sans leading-relaxed outline-none"
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              id="btn_evaluate_triage"
              disabled={loading || !patientText.trim()}
              onClick={() => runAssessment(patientText, followUpAnswers)}
              className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 px-4 rounded-xl shadow-md shadow-slate-200 transition cursor-pointer text-xs disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Evaluating Clinical Protocols...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Run Intake Triage &amp; Rule Matching</span>
                </>
              )}
            </button>
          </div>

          {/* Missing Information & Targeted Follow-Up Questions Card */}
          {result && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2 text-blue-600 font-bold text-xs">
                  <HelpCircle className="w-4 h-4" />
                  <span>Targeted Clinical Follow-Up Screening</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded font-medium">
                    {Object.keys(followUpAnswers).length} Answers Recorded
                  </span>
                  {Object.keys(followUpAnswers).length > 0 && (
                    <button
                      type="button"
                      id="btn_clear_followups"
                      onClick={handleClearFollowUps}
                      className="text-[10px] text-red-600 hover:text-red-700 font-medium underline cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed">
                Whenever key parameters (cardiac radiation, meningeal signs, Ottawa weight-bearing) are unmentioned, answer these follow-ups to refine the rule matching.
              </p>

              {/* Dynamic Follow-Up Questions */}
              <div className="space-y-3 pt-1">
                {/* 1. Chest Pain Screen */}
                {result.facts.complaint_family === "chest_pain" && (
                  <>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                      <div className="text-xs text-slate-800 font-medium">
                        Does the pain radiate to your left arm, neck, shoulder, or jaw?
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          id="btn_followup_rad_yes"
                          onClick={() => handleFollowUpAnswer("radiation_arm_jaw", true)}
                          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
                            followUpAnswers.radiation_arm_jaw === true
                              ? "bg-red-600 text-white shadow-xs"
                              : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          Yes (Radiates)
                        </button>
                        <button
                          type="button"
                          id="btn_followup_rad_no"
                          onClick={() => handleFollowUpAnswer("radiation_arm_jaw", false)}
                          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
                            followUpAnswers.radiation_arm_jaw === false
                              ? "bg-emerald-600 text-white shadow-xs"
                              : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          No (Localized)
                        </button>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                      <div className="text-xs text-slate-800 font-medium">
                        Are you experiencing profuse cold sweating (diaphoresis) or clammy skin?
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          id="btn_followup_diaph_yes"
                          onClick={() => handleFollowUpAnswer("diaphoresis", true)}
                          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
                            followUpAnswers.diaphoresis === true
                              ? "bg-red-600 text-white shadow-xs"
                              : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          Yes (Sweating)
                        </button>
                        <button
                          type="button"
                          id="btn_followup_diaph_no"
                          onClick={() => handleFollowUpAnswer("diaphoresis", false)}
                          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
                            followUpAnswers.diaphoresis === false
                              ? "bg-emerald-600 text-white shadow-xs"
                              : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          No (Normal)
                        </button>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                      <div className="text-xs text-slate-800 font-medium">
                        Is the sensation crushing or elephant-on-chest pressure rather than reproducible muscular pain?
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          id="btn_followup_crush_yes"
                          onClick={() => handleFollowUpAnswer("crushing_pressure", true)}
                          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
                            followUpAnswers.crushing_pressure === true
                              ? "bg-red-600 text-white shadow-xs"
                              : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          Yes (Crushing / Tight)
                        </button>
                        <button
                          type="button"
                          id="btn_followup_crush_no"
                          onClick={() => handleFollowUpAnswer("crushing_pressure", false)}
                          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
                            followUpAnswers.crushing_pressure === false
                              ? "bg-emerald-600 text-white shadow-xs"
                              : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          No (Sharp / Muscular)
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* 2. Fever Screen */}
                {result.facts.complaint_family === "fever" && (
                  <>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                      <div className="text-xs text-slate-800 font-medium">
                        Is there neck stiffness (pain bending chin to chest) or a purple spotty rash?
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          id="btn_followup_neck_yes"
                          onClick={() => handleFollowUpAnswer("stiff_neck", true)}
                          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
                            followUpAnswers.stiff_neck === true
                              ? "bg-red-600 text-white shadow-xs"
                              : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          Yes (Meningeal Sign)
                        </button>
                        <button
                          type="button"
                          id="btn_followup_neck_no"
                          onClick={() => handleFollowUpAnswer("stiff_neck", false)}
                          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
                            followUpAnswers.stiff_neck === false
                              ? "bg-emerald-600 text-white shadow-xs"
                              : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          No (Normal Neck)
                        </button>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                      <div className="text-xs text-slate-800 font-medium">
                        Is the patient an infant under 3 months of age (&lt;90 days old)?
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          id="btn_followup_neonate_yes"
                          onClick={() => handleFollowUpAnswer("patient_age_neonate", true)}
                          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
                            followUpAnswers.patient_age_neonate === true
                              ? "bg-rose-600 text-white shadow-xs"
                              : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          Yes (Neonate &lt;3mo)
                        </button>
                        <button
                          type="button"
                          id="btn_followup_neonate_no"
                          onClick={() => handleFollowUpAnswer("patient_age_neonate", false)}
                          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
                            followUpAnswers.patient_age_neonate === false
                              ? "bg-emerald-600 text-white shadow-xs"
                              : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          No (Older Child/Adult)
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* 3. Injury Screen */}
                {result.facts.complaint_family === "injury" && (
                  <>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                      <div className="text-xs text-slate-800 font-medium">
                        Can the patient bear weight and take 4 consecutive steps right now (Ottawa Rule)?
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          id="btn_followup_walk_yes"
                          onClick={() => handleFollowUpAnswer("cannot_bear_weight", false)}
                          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
                            followUpAnswers.cannot_bear_weight === false
                              ? "bg-emerald-600 text-white shadow-xs"
                              : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          Yes (Can Walk)
                        </button>
                        <button
                          type="button"
                          id="btn_followup_walk_no"
                          onClick={() => handleFollowUpAnswer("cannot_bear_weight", true)}
                          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
                            followUpAnswers.cannot_bear_weight === true
                              ? "bg-amber-600 text-white shadow-xs"
                              : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          No (Cannot Bear Weight)
                        </button>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                      <div className="text-xs text-slate-800 font-medium">
                        Is there open fracture, visible bone deformity, or arterial bleeding?
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          id="btn_followup_deformity_yes"
                          onClick={() => handleFollowUpAnswer("active_bleeding", true)}
                          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
                            followUpAnswers.active_bleeding === true
                              ? "bg-red-600 text-white shadow-xs"
                              : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          Yes (Deformity / Bleeding)
                        </button>
                        <button
                          type="button"
                          id="btn_followup_deformity_no"
                          onClick={() => handleFollowUpAnswer("active_bleeding", false)}
                          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
                            followUpAnswers.active_bleeding === false
                              ? "bg-emerald-600 text-white shadow-xs"
                              : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          No (Closed / Intact)
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* 4. Breathing Screen */}
                {result.facts.complaint_family === "breathing_difficulty" && (
                  <>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                      <div className="text-xs text-slate-800 font-medium">
                        Can the patient speak a full complete sentence without pausing for breath?
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          id="btn_followup_sentences_yes"
                          onClick={() => handleFollowUpAnswer("unable_to_speak_sentences", false)}
                          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
                            followUpAnswers.unable_to_speak_sentences === false
                              ? "bg-emerald-600 text-white shadow-xs"
                              : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          Yes (Full Sentences)
                        </button>
                        <button
                          type="button"
                          id="btn_followup_sentences_no"
                          onClick={() => handleFollowUpAnswer("unable_to_speak_sentences", true)}
                          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
                            followUpAnswers.unable_to_speak_sentences === true
                              ? "bg-red-600 text-white shadow-xs"
                              : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          No (Gasping / Single Words)
                        </button>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                      <div className="text-xs text-slate-800 font-medium">
                        Is there inspiratory stridor, cyanosis (blue lips/fingers), or airway compromise?
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          id="btn_followup_stridor_yes"
                          onClick={() => handleFollowUpAnswer("stridor", true)}
                          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
                            followUpAnswers.stridor === true
                              ? "bg-red-600 text-white shadow-xs"
                              : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          Yes (Stridor / Cyanosis)
                        </button>
                        <button
                          type="button"
                          id="btn_followup_stridor_no"
                          onClick={() => handleFollowUpAnswer("stridor", false)}
                          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
                            followUpAnswers.stridor === false
                              ? "bg-emerald-600 text-white shadow-xs"
                              : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          No (Airway Clear)
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* 5. Abdominal Pain Screen */}
                {result.facts.complaint_family === "abdominal_pain" && (
                  <>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                      <div className="text-xs text-slate-800 font-medium">
                        Does the abdomen feel rock-hard or rigid (board-like) with severe involuntary guarding?
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          id="btn_followup_rigid_yes"
                          onClick={() => handleFollowUpAnswer("rigid_abdomen", true)}
                          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
                            followUpAnswers.rigid_abdomen === true
                              ? "bg-red-600 text-white shadow-xs"
                              : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          Yes (Board-Like Rigidity)
                        </button>
                        <button
                          type="button"
                          id="btn_followup_rigid_no"
                          onClick={() => handleFollowUpAnswer("rigid_abdomen", false)}
                          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
                            followUpAnswers.rigid_abdomen === false
                              ? "bg-emerald-600 text-white shadow-xs"
                              : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          No (Soft / Mild Guarding)
                        </button>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                      <div className="text-xs text-slate-800 font-medium">
                        Has the patient experienced dizziness, fainting, or syncope upon standing?
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          id="btn_followup_syncope_yes"
                          onClick={() => handleFollowUpAnswer("syncope", true)}
                          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
                            followUpAnswers.syncope === true
                              ? "bg-red-600 text-white shadow-xs"
                              : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          Yes (Syncope / Dizzy)
                        </button>
                        <button
                          type="button"
                          id="btn_followup_syncope_no"
                          onClick={() => handleFollowUpAnswer("syncope", false)}
                          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
                            followUpAnswers.syncope === false
                              ? "bg-emerald-600 text-white shadow-xs"
                              : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          No (Hemodynamically Stable)
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* 6. General / Other Family Screen */}
                {result.facts.complaint_family !== "chest_pain" &&
                  result.facts.complaint_family !== "fever" &&
                  result.facts.complaint_family !== "injury" &&
                  result.facts.complaint_family !== "breathing_difficulty" &&
                  result.facts.complaint_family !== "abdominal_pain" && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                      <div className="text-xs text-slate-800 font-medium">
                        Has the patient experienced altered mental status, confusion, or syncope?
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          id="btn_followup_general_syncope_yes"
                          onClick={() => handleFollowUpAnswer("syncope", true)}
                          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
                            followUpAnswers.syncope === true
                              ? "bg-red-600 text-white shadow-xs"
                              : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          Yes (Altered / Syncope)
                        </button>
                        <button
                          type="button"
                          id="btn_followup_general_syncope_no"
                          onClick={() => handleFollowUpAnswer("syncope", false)}
                          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
                            followUpAnswers.syncope === false
                              ? "bg-emerald-600 text-white shadow-xs"
                              : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          No (Alert &amp; Oriented)
                        </button>
                      </div>
                    </div>
                  )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Standardized Clinical Triage Note (7 cols) */}
        <div className="lg:col-span-7">
          {result ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
              {/* Header with Urgency Banner */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Clinical Triage Note</span>
                    <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-600 font-mono text-[10px] font-bold border border-blue-100">
                      {result.triage_note.track_id}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mt-1">
                    {result.triage_note.department}
                  </h3>
                </div>

                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <button
                    type="button"
                    id="btn_copy_note"
                    onClick={copyTriageNote}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition cursor-pointer shadow-xs"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? "Copied to EHR!" : "Copy Note"}</span>
                  </button>

                  <button
                    type="button"
                    id="btn_download_note"
                    onClick={downloadTriageNote}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold transition cursor-pointer"
                  >
                    {downloaded ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Download className="w-3.5 h-3.5" />}
                    <span>{downloaded ? "Saved!" : "Export .txt"}</span>
                  </button>

                  <button
                    type="button"
                    id="btn_print_note"
                    onClick={printTriageNote}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold transition cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print</span>
                  </button>
                </div>
              </div>

              {/* Urgency Level Box */}
              {(() => {
                const badge = getUrgencyBadge(result.triage_note.urgency_level);
                return (
                  <div className={`p-4 rounded-2xl border ${badge.bg} flex items-center justify-between`}>
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-white/80 border border-current/10 shadow-2xs">
                        {badge.icon}
                      </div>
                      <div>
                        <div className="text-xs font-bold tracking-wider">{badge.tag}</div>
                        <div className="text-[11px] opacity-90 mt-0.5 font-medium">{badge.wait}</div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-2xl font-black">Level {result.triage_note.urgency_level}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Protocol Citation Box */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-blue-600" />
                    <span>Deterministic Protocol Grounding</span>
                  </span>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                    {result.triage_note.rule_id}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed font-sans">
                  {result.triage_note.citation_text}
                </p>
              </div>

              {/* Human Escalation Alert (if applicable) */}
              {result.triage_note.escalate_to_human && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-red-900">Mandatory Human Clinical Escalation Required</div>
                        <div className="text-red-700 text-[11px] mt-0.5">
                          Case exhibits elevated risk indicators or critical clinical uncertainty. The system refuses to guess and mandates immediate bedside evaluation by a clinician.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-red-200/60 flex items-center justify-between">
                    {escalationAcknowledged ? (
                      <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs bg-emerald-100/80 px-3 py-1.5 rounded-lg border border-emerald-200">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Bedside Clinician Dispatched &amp; Resuscitation Bay Alerted</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        id="btn_ack_escalation"
                        onClick={handleAcknowledgeEscalation}
                        className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-2 cursor-pointer"
                      >
                        <UserCheck className="w-4 h-4" />
                        <span>Acknowledge &amp; Dispatch Bedside Clinician</span>
                      </button>
                    )}
                    <span className="text-[10px] text-red-500 font-mono">PRIORITY_QUEUE_01</span>
                  </div>
                </div>
              )}

              {/* Structured Triple Breakdown: Reported vs Established vs Unknown */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* 1. What patient reported */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      <span>Patient Reported</span>
                    </div>
                    <ul className="space-y-1.5 text-xs text-slate-700">
                      {result.triage_note.what_patient_reported.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-slate-400 shrink-0 mt-0.5">&bull;</span>
                          <span className="text-[11px] leading-snug">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* 2. What follow-ups established */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>Established Findings</span>
                    </div>
                    {result.triage_note.what_followups_established.length > 0 ? (
                      <ul className="space-y-1.5 text-xs text-slate-700">
                        {result.triage_note.what_followups_established.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="text-emerald-600 shrink-0 mt-0.5">&bull;</span>
                            <span className="text-[11px] leading-snug">{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic">No additional findings answered yet.</p>
                    )}
                  </div>
                </div>

                {/* 3. What remains unknown */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <span>Remains Unknown</span>
                    </div>
                    {result.triage_note.what_remains_unknown.length > 0 ? (
                      <ul className="space-y-1.5 text-xs text-slate-700">
                        {result.triage_note.what_remains_unknown.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="text-amber-500 shrink-0 mt-0.5">&bull;</span>
                            <span className="text-[11px] leading-snug">{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> All red-flag screens completed.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Recommended Next Step: Doctor Slot Booking Card */}
              <div className="p-4 rounded-xl bg-linear-to-r from-blue-50 to-indigo-50 border border-blue-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-blue-900 flex items-center gap-2">
                      <span>Schedule Meeting with Doctor</span>
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                        {result.triage_note.department}
                      </span>
                    </div>
                    <div className="text-[11px] text-blue-700 mt-0.5">
                      Book an immediate consultation or reserved time slot with an attending physician.
                    </div>
                  </div>
                </div>

                {onNavigateTab && (
                  <button
                    type="button"
                    id="btn_triage_book_doctor"
                    onClick={() => onNavigateTab("booking")}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap self-stretch sm:self-auto justify-center"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Book Doctor Slot Now</span>
                  </button>
                )}
              </div>

              {/* Collapsible Clinical Facts & Entities Inspector */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  id="btn_toggle_facts"
                  onClick={() => setShowRawFacts(!showRawFacts)}
                  className="flex items-center justify-between w-full py-2 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition cursor-pointer border border-slate-200"
                >
                  <div className="flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-blue-600" />
                    <span>Clinical Entity Extraction Trace (Structured LLM Facts &rarr; Deterministic Rule Engine)</span>
                  </div>
                  {showRawFacts ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </button>

                {showRawFacts && (
                  <div className="mt-3 p-4 rounded-xl bg-slate-900 text-slate-200 text-xs font-mono overflow-x-auto shadow-inner border border-slate-800 space-y-2">
                    <div className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">
                      // Extracted Symptoms &amp; Extracted Clinical Entities (JSON)
                    </div>
                    <pre className="text-[11px] leading-relaxed">
                      {JSON.stringify({
                        extracted_facts: result.facts,
                        rule_applied: result.triage_note.rule_id,
                        urgency_level: result.triage_note.urgency_level,
                        routing: result.triage_note.department
                      }, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              {/* Non-Diagnostic Clinical Safety Assurance Banner */}
              <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 leading-relaxed flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-800">Intake Safety Mandate:</strong> {result.triage_note.disclaimer}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[420px] bg-white border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-400">
                <Stethoscope className="w-8 h-8 text-slate-400" />
              </div>
              <h4 className="text-base font-bold text-slate-800 tracking-tight">Awaiting Patient Description</h4>
              <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
                Enter symptoms or click any 1-Click test scenario at the top to evaluate clinical triage rules, cite protocols, and produce the structured note.
              </p>
            </div>
          )}
        </div>
      </div>
        </>
      )}
    </div>
  );
};
