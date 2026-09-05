import React, { useState, useEffect } from "react";
import { 
  FolderHeart, 
  Calendar, 
  Clock, 
  User, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Trash2, 
  Download, 
  Printer, 
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  MapPin,
  Stethoscope
} from "lucide-react";
import { Appointment, IntakeRecord, User as AppUser } from "../types";

interface PatientRecordsViewProps {
  currentUser: AppUser;
  onBookNewSlot?: () => void;
}

export const PatientRecordsView: React.FC<PatientRecordsViewProps> = ({
  currentUser,
  onBookNewSlot
}) => {
  const [activeTab, setActiveTab] = useState<"appointments" | "intakes">("appointments");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [intakes, setIntakes] = useState<IntakeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedIntakeId, setExpandedIntakeId] = useState<string | null>(null);

  const isStaff = currentUser.accountType === "staff" || currentUser.role.toLowerCase().includes("officer") || currentUser.role.toLowerCase().includes("nurse") || currentUser.role.toLowerCase().includes("doctor");

  const fetchData = async () => {
    setLoading(true);
    try {
      // If staff, get all appointments and records; if patient, filter by patientId
      const aptQuery = isStaff ? "" : `?patientId=${currentUser.id}`;
      const intakeQuery = isStaff ? "" : `?patientId=${currentUser.id}`;

      const [aptRes, intakeRes] = await Promise.all([
        fetch(`/api/appointments${aptQuery}`),
        fetch(`/api/intake/records${intakeQuery}`)
      ]);

      const aptData = await aptRes.json();
      const intakeData = await intakeRes.json();

      if (aptData.appointments) setAppointments(aptData.appointments);
      if (intakeData.records) setIntakes(intakeData.records);
    } catch (err) {
      console.error("Failed to load records:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUser]);

  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

  const handleCancelAppointment = async (id: string) => {
    if (confirmCancelId !== id) {
      setConfirmCancelId(id);
      return;
    }

    try {
      const res = await fetch(`/api/appointments/${id}`, { method: "DELETE" });
      if (res.ok) {
        setAppointments((prev) => prev.filter((a) => a.id !== id));
        setConfirmCancelId(null);
      }
    } catch (err) {
      console.error("Cancel appointment error:", err);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/appointments/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        setAppointments((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status: newStatus as any } : a))
        );
      }
    } catch (err) {
      console.error("Update status error:", err);
    }
  };

  const handleDownloadIntake = (record: IntakeRecord) => {
    const text = `======================================================
HOSPITAL CLINICAL INTAKE RECORD
======================================================
Record ID:      ${record.id}
Date/Time:      ${new Date(record.timestamp).toLocaleString()}
Patient Name:   ${record.patientName}
Email:          ${record.patientEmail || "N/A"}

TRIAGE SUMMARY:
Urgency Level:  Level ${record.triageNote?.urgency_level || "N/A"} - ${record.triageNote?.urgency_name || "N/A"}
Department:     ${record.triageNote?.department || "N/A"}
Protocol Rule:  ${record.triageNote?.rule_id || "N/A"}
Escalate Human: ${record.triageNote?.escalate_to_human ? "YES" : "NO"}

PATIENT DESCRIPTION / STATEMENT:
${record.patientDescription}

CHECKLIST FINDINGS VERIFIED:
${record.checklistItems?.length ? record.checklistItems.map((c) => `  - ${c}`).join("\n") : "  None recorded"}

CLINICAL RATIONALE & CITATION:
${record.triageNote?.citation_text || record.triageNote?.reasoning || "N/A"}
======================================================`;

    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Intake_Record_${record.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div id="patient_records_view" className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FolderHeart className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {isStaff ? "Hospital Clinical Intake Queue & Doctor Appointments" : "My Health Records & Doctor Appointments"}
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Persistently stored records for intake evaluations, verified checklist items, and scheduled doctor slots.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchData}
            className="p-2 text-slate-600 hover:text-blue-600 rounded-xl border border-slate-200 hover:bg-slate-50 transition cursor-pointer"
            title="Refresh records"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          {onBookNewSlot && (
            <button
              type="button"
              id="btn_records_book_slot"
              onClick={onBookNewSlot}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Book New Doctor Slot</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("appointments")}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
            activeTab === "appointments"
              ? "bg-slate-900 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Doctor Appointments ({appointments.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("intakes")}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
            activeTab === "intakes"
              ? "bg-slate-900 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Intake Assessments &amp; Checklists ({intakes.length})</span>
        </button>
      </div>

      {/* Appointments View */}
      {activeTab === "appointments" && (
        <div className="space-y-4">
          {appointments.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
              <Calendar className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-slate-800">No Appointments Scheduled Yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                You haven't booked any doctor consultation slots yet. Click below to view available doctors and choose a slot.
              </p>
              {onBookNewSlot && (
                <button
                  type="button"
                  onClick={onBookNewSlot}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Schedule an Appointment</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {appointments.map((apt) => {
                const isUrgent = apt.urgencyLevel <= 2;
                return (
                  <div
                    key={apt.id}
                    className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition space-y-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isUrgent ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                          }`}>
                            Level {apt.urgencyLevel} &bull; {apt.urgencyName}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            apt.status === "Confirmed"
                              ? "bg-emerald-100 text-emerald-800"
                              : apt.status === "In Consultation"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-600"
                          }`}>
                            {apt.status}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-slate-900 mt-2">
                          {apt.doctorName}
                        </h3>
                        <p className="text-xs text-blue-600 font-semibold">{apt.doctorSpecialty}</p>
                      </div>

                      <span className="text-[10px] font-mono text-slate-400">
                        #{apt.id.slice(-6).toUpperCase()}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Date &amp; Slot</span>
                        <span className="font-semibold text-slate-800">{apt.date} at {apt.timeSlot}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Consultation Bay</span>
                        <span className="font-semibold text-slate-800">{apt.doctorRoom}</span>
                      </div>
                      <div className="col-span-2 pt-1 border-t border-slate-200/60">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Patient</span>
                        <span className="text-slate-800">{apt.patientName} &bull; {apt.patientPhone || apt.patientEmail}</span>
                      </div>
                    </div>

                    {apt.reason && (
                      <p className="text-xs text-slate-600 line-clamp-2">
                        <strong>Reason:</strong> {apt.reason}
                      </p>
                    )}

                    {apt.checklistSummary && apt.checklistSummary.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {apt.checklistSummary.slice(0, 3).map((item, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                            &bull; {item}
                          </span>
                        ))}
                        {apt.checklistSummary.length > 3 && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-500">
                            +{apt.checklistSummary.length - 3} more
                          </span>
                        )}
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      {isStaff ? (
                        <div className="flex items-center gap-1.5">
                          <select
                            value={apt.status}
                            onChange={(e) => handleUpdateStatus(apt.id, e.target.value)}
                            className="text-[11px] font-bold px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-800"
                          >
                            <option value="Confirmed">Confirmed</option>
                            <option value="In Consultation">In Consultation</option>
                            <option value="Completed">Completed</option>
                          </select>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400">
                          Booked on {new Date(apt.createdAt).toLocaleDateString()}
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => handleCancelAppointment(apt.id)}
                        className={`text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer px-2 py-1 rounded-lg ${
                          confirmCancelId === apt.id
                            ? "bg-red-600 text-white hover:bg-red-700"
                            : "text-red-500 hover:text-red-700 hover:bg-red-50"
                        }`}
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>{confirmCancelId === apt.id ? "Confirm Cancel?" : "Cancel Slot"}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Intakes View */}
      {activeTab === "intakes" && (
        <div className="space-y-4">
          {intakes.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
              <FileText className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-slate-800">No Intake Assessments Stored Yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Completed intake evaluations and triage notes are automatically stored here for clinical auditing and review.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {intakes.map((record) => {
                const isExpanded = expandedIntakeId === record.id;
                const urgency = record.triageNote?.urgency_level || 3;

                return (
                  <div
                    key={record.id}
                    className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                          urgency <= 2 ? "bg-red-600 text-white" : urgency === 3 ? "bg-amber-500 text-white" : "bg-emerald-600 text-white"
                        }`}>
                          Level {urgency} &bull; {record.triageNote?.urgency_name || "Assessment"}
                        </span>
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">{record.patientName}</h4>
                          <span className="text-[11px] text-slate-400">
                            {new Date(record.timestamp).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleDownloadIntake(record)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium flex items-center gap-1 transition cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Export Note</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setExpandedIntakeId(isExpanded ? null : record.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium flex items-center gap-1 transition cursor-pointer"
                        >
                          <span>{isExpanded ? "Collapse" : "Details"}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <strong>Patient Complaint:</strong> {record.patientDescription}
                    </p>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="pt-3 border-t border-slate-100 space-y-3 text-xs">
                        {record.checklistItems && record.checklistItems.length > 0 && (
                          <div>
                            <span className="font-bold text-slate-700 block mb-1">Reported Findings Checklist:</span>
                            <div className="flex flex-wrap gap-1.5">
                              {record.checklistItems.map((c, i) => (
                                <span key={i} className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 text-[11px]">
                                  &bull; {c}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {record.triageNote && (
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                            <span className="font-bold text-slate-900 block">Clinical Triage Note:</span>
                            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                              <div><strong>Department:</strong> {record.triageNote.department}</div>
                              <div><strong>Action:</strong> {record.triageNote.recommended_action}</div>
                            </div>
                            <p className="text-slate-600 text-[11px] pt-1 border-t border-slate-200">
                              <strong>Clinical Rationale:</strong> {record.triageNote.clinical_rationale}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
