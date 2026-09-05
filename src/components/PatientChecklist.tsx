import React, { useState } from "react";
import { 
  CheckSquare, 
  Square, 
  Plus, 
  Trash2, 
  AlertTriangle, 
  Clock, 
  HeartPulse, 
  Sparkles, 
  RotateCcw,
  CheckCircle2,
  ListFilter
} from "lucide-react";
import { ChecklistItem } from "../types";

export const DEFAULT_CHECKLIST_ITEMS: ChecklistItem[] = [
  // Current Symptoms
  { id: "sym-chest", category: "symptom", label: "Chest pain, tightness, or heavy crushing pressure", checked: false, severity: "severe" },
  { id: "sym-breath", category: "symptom", label: "Shortness of breath / difficulty catching breath", checked: false, severity: "severe" },
  { id: "sym-sweat", category: "symptom", label: "Cold sweats, clamminess, or unexplained diaphoresis", checked: false, severity: "moderate" },
  { id: "sym-radiat", category: "symptom", label: "Pain radiating to left arm, shoulder, neck, or jaw", checked: false, severity: "severe" },
  { id: "sym-fever", category: "symptom", label: "High fever (above 100.4°F / 38°C) or severe chills", checked: false, severity: "moderate" },
  { id: "sym-stiffneck", category: "symptom", label: "Stiff neck or inability to touch chin to chest", checked: false, severity: "severe" },
  { id: "sym-stomach", category: "symptom", label: "Sharp or severe abdominal pain (especially right side)", checked: false, severity: "moderate" },
  { id: "sym-rigid", category: "symptom", label: "Abdomen feels hard, rigid, or painful when pressed", checked: false, severity: "severe" },
  { id: "sym-nausea", category: "symptom", label: "Persistent nausea or vomiting (unable to keep liquids)", checked: false, severity: "mild" },
  { id: "sym-fall", category: "symptom", label: "Physical trauma, hard fall, or impact injury", checked: false, severity: "moderate" },
  { id: "sym-weight", category: "symptom", label: "Unable to bear weight or walk on injured limb", checked: false, severity: "moderate" },
  { id: "sym-bleed", category: "symptom", label: "Active bleeding or open wound", checked: false, severity: "severe" },
  { id: "sym-dizzy", category: "symptom", label: "Dizziness, lightheadedness, or feeling faint / syncope", checked: false, severity: "moderate" },

  // Onset & Timeline
  { id: "onset-sudden", category: "onset", label: "Started suddenly within the last 2 hours", checked: false },
  { id: "onset-gradual", category: "onset", label: "Gradual onset getting worse over several days", checked: false },
  { id: "onset-exertion", category: "onset", label: "Triggered or worsened by physical exertion / climbing stairs", checked: false },
  { id: "onset-deepbreath", category: "onset", label: "Worse on deep inhalation or coughing (pleuritic)", checked: false },
  { id: "onset-lyingflat", category: "onset", label: "Worse when lying flat on back", checked: false },

  // Background & Red Flags
  { id: "bg-asthma", category: "red_flag", label: "History of asthma, COPD, or reactive airway disease", checked: false },
  { id: "bg-heart", category: "red_flag", label: "History of cardiac condition, stent, or high blood pressure", checked: false },
  { id: "bg-diabetes", category: "red_flag", label: "Patient has diabetes or takes insulin", checked: false },
  { id: "bg-allergy", category: "red_flag", label: "Known severe allergies or recent new medication", checked: false },
  { id: "bg-infant", category: "red_flag", label: "Patient is an infant under 3 months old with fever", checked: false }
];

interface PatientChecklistProps {
  items: ChecklistItem[];
  onItemsChange: (items: ChecklistItem[]) => void;
  onApplyToTriage?: (summaryText: string) => void;
}

export const PatientChecklist: React.FC<PatientChecklistProps> = ({
  items,
  onItemsChange,
  onApplyToTriage
}) => {
  const [activeCategory, setActiveCategory] = useState<"all" | "symptom" | "onset" | "red_flag" | "custom">("all");
  const [customInput, setCustomInput] = useState("");

  const handleToggle = (id: string) => {
    const updated = items.map((item) =>
      item.id === id ? { ...item, checked: !item.checked } : item
    );
    onItemsChange(updated);
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim()) return;

    const newItem: ChecklistItem = {
      id: `custom_${Date.now()}`,
      category: "custom",
      label: customInput.trim(),
      checked: true,
      severity: "moderate"
    };

    onItemsChange([newItem, ...items]);
    setCustomInput("");
  };

  const handleDeleteCustom = (id: string) => {
    onItemsChange(items.filter((item) => item.id !== id));
  };

  const handleClearAll = () => {
    onItemsChange(items.map((item) => ({ ...item, checked: false })));
  };

  const handleSelectBundle = (bundleType: "chest" | "fever" | "injury" | "breath" | "belly") => {
    const updated = items.map((item) => {
      if (bundleType === "chest") {
        return {
          ...item,
          checked: ["sym-chest", "sym-sweat", "sym-radiat", "onset-sudden", "bg-heart"].includes(item.id)
        };
      }
      if (bundleType === "fever") {
        return {
          ...item,
          checked: ["sym-fever", "sym-stiffneck", "sym-nausea", "onset-gradual"].includes(item.id)
        };
      }
      if (bundleType === "injury") {
        return {
          ...item,
          checked: ["sym-fall", "sym-weight", "sym-bleed", "onset-sudden"].includes(item.id)
        };
      }
      if (bundleType === "breath") {
        return {
          ...item,
          checked: ["sym-breath", "onset-sudden", "bg-asthma"].includes(item.id)
        };
      }
      if (bundleType === "belly") {
        return {
          ...item,
          checked: ["sym-stomach", "sym-rigid", "sym-nausea", "onset-sudden"].includes(item.id)
        };
      }
      return item;
    });
    onItemsChange(updated);
  };

  const checkedCount = items.filter((i) => i.checked).length;
  const filteredItems = activeCategory === "all" ? items : items.filter((i) => i.category === activeCategory);

  const generateSummaryText = () => {
    const checked = items.filter((i) => i.checked);
    if (checked.length === 0) return "";
    return `Patient reports the following verified checklist items: ${checked.map((c) => c.label).join("; ")}.`;
  };

  return (
    <div id="patient_checklist_container" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Patient Symptoms &amp; Event Checklist
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Check off what is happening with the patient to ensure complete clinical evaluation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
            {checkedCount} Selected
          </span>
          {checkedCount > 0 && (
            <button
              type="button"
              id="btn_clear_checklist"
              onClick={handleClearAll}
              className="text-xs text-slate-500 hover:text-red-600 flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-50 transition cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Quick Common Bundles */}
      <div className="space-y-1.5">
        <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-500" />
          <span>Quick 1-Click Complaint Bundles:</span>
        </span>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => handleSelectBundle("chest")}
            className="px-2.5 py-1 text-xs font-medium rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition cursor-pointer"
          >
            🫀 Chest Tightness
          </button>
          <button
            type="button"
            onClick={() => handleSelectBundle("breath")}
            className="px-2.5 py-1 text-xs font-medium rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 transition cursor-pointer"
          >
            🫁 Severe Dyspnea
          </button>
          <button
            type="button"
            onClick={() => handleSelectBundle("fever")}
            className="px-2.5 py-1 text-xs font-medium rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition cursor-pointer"
          >
            🌡️ High Fever &amp; Chills
          </button>
          <button
            type="button"
            onClick={() => handleSelectBundle("injury")}
            className="px-2.5 py-1 text-xs font-medium rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 transition cursor-pointer"
          >
            🦴 Fall / Bone Trauma
          </button>
          <button
            type="button"
            onClick={() => handleSelectBundle("belly")}
            className="px-2.5 py-1 text-xs font-medium rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition cursor-pointer"
          >
            🩺 Acute Abdomen
          </button>
        </div>
      </div>

      {/* Add Custom Patient Note / Symptom */}
      <form onSubmit={handleAddCustom} className="flex gap-2">
        <input
          type="text"
          id="input_custom_symptom"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          placeholder="Type what happened with patient (e.g. Slipped in bathroom, took 500mg aspirin)..."
          className="flex-1 text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white text-slate-800 placeholder:text-slate-400"
        />
        <button
          type="submit"
          id="btn_add_custom_symptom"
          className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add to Checklist</span>
        </button>
      </form>

      {/* Category Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-100">
        <button
          type="button"
          onClick={() => setActiveCategory("all")}
          className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
            activeCategory === "all" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          All Items ({items.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveCategory("symptom")}
          className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition cursor-pointer ${
            activeCategory === "symptom" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <HeartPulse className="w-3 h-3" />
          <span>Symptoms</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveCategory("onset")}
          className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition cursor-pointer ${
            activeCategory === "onset" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Clock className="w-3 h-3" />
          <span>Onset &amp; Timeline</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveCategory("red_flag")}
          className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition cursor-pointer ${
            activeCategory === "red_flag" ? "bg-red-600 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <AlertTriangle className="w-3 h-3" />
          <span>Red Flags &amp; History</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveCategory("custom")}
          className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition cursor-pointer ${
            activeCategory === "custom" ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <ListFilter className="w-3 h-3" />
          <span>Custom Added</span>
        </button>
      </div>

      {/* Checklist Items List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-1">
        {filteredItems.map((item) => {
          return (
            <div
              key={item.id}
              onClick={() => handleToggle(item.id)}
              className={`p-2.5 rounded-xl border flex items-start justify-between gap-2.5 transition cursor-pointer text-xs ${
                item.checked
                  ? "bg-blue-50/90 border-blue-300 text-blue-950 font-medium shadow-2xs"
                  : "bg-slate-50/60 hover:bg-slate-100/70 border-slate-200 text-slate-700"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 shrink-0 text-blue-600">
                  {item.checked ? (
                    <CheckSquare className="w-4 h-4 fill-blue-600 text-white" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                </div>
                <span className="leading-snug">{item.label}</span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {item.category === "custom" && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCustom(item.id);
                    }}
                    className="p-1 text-slate-400 hover:text-red-500 rounded transition cursor-pointer"
                    title="Remove custom note"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                {item.category === "red_flag" && (
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                    Flag
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Action / Sync to Triage Note */}
      {checkedCount > 0 && onApplyToTriage && (
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            {checkedCount} clinical findings selected ready for doctor note.
          </span>
          <button
            type="button"
            id="btn_sync_checklist_triage"
            onClick={() => onApplyToTriage(generateSummaryText())}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Apply Selected Findings to Intake</span>
          </button>
        </div>
      )}
    </div>
  );
};
