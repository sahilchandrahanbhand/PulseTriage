import React, { useState, useEffect } from "react";
import { 
  Calendar, 
  Clock, 
  User, 
  MapPin, 
  Star, 
  CheckCircle2, 
  AlertTriangle, 
  Printer, 
  Download, 
  Search, 
  Sparkles,
  ArrowRight,
  ShieldAlert,
  ChevronRight,
  Stethoscope
} from "lucide-react";
import { Doctor, Appointment, User as AppUser, ChecklistItem, TriageResult } from "../types";

interface DoctorBookingViewProps {
  currentUser: AppUser;
  triageResult?: TriageResult | null;
  checklistItems?: ChecklistItem[];
  onBookingSuccess?: (appointment: Appointment) => void;
  onViewRecords?: () => void;
}

export const DoctorBookingView: React.FC<DoctorBookingViewProps> = ({
  currentUser,
  triageResult,
  checklistItems = [],
  onBookingSuccess,
  onViewRecords
}) => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("Today");
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [specialtyFilter, setSpecialtyFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookedAppointment, setBookedAppointment] = useState<Appointment | null>(null);
  const [patientPhone, setPatientPhone] = useState(currentUser.phone || "");
  const [bookingReason, setBookingReason] = useState(
    triageResult
      ? `${triageResult.triage_note.urgency_name} (${triageResult.facts.complaint_family || "Walk-in"})`
      : "Clinical consultation for symptoms"
  );

  useEffect(() => {
    fetch("/api/doctors")
      .then((res) => res.json())
      .then((data) => {
        if (data.doctors && data.doctors.length > 0) {
          setDoctors(data.doctors);

          // Auto-select best matching doctor based on triage if available
          const family = triageResult?.facts?.complaint_family;
          let bestDoc = data.doctors[0];
          if (family === "chest_pain") {
            bestDoc = data.doctors.find((d: any) => d.specialty.toLowerCase().includes("cardio") || d.id.includes("rostova")) || data.doctors[0];
          } else if (family === "breathing_difficulty") {
            bestDoc = data.doctors.find((d: any) => d.specialty.toLowerCase().includes("pulmon") || d.id.includes("patel")) || data.doctors[0];
          } else if (family === "injury") {
            bestDoc = data.doctors.find((d: any) => d.specialty.toLowerCase().includes("ortho") || d.id.includes("wilson")) || data.doctors[0];
          } else if (family === "fever" && triageResult?.facts?.age_months && triageResult.facts.age_months < 36) {
            bestDoc = data.doctors.find((d: any) => d.specialty.toLowerCase().includes("pediatric") || d.id.includes("lin")) || data.doctors[0];
          } else if (triageResult?.triage_note?.urgency_level === 1 || triageResult?.triage_note?.urgency_level === 2) {
            bestDoc = data.doctors.find((d: any) => d.id.includes("vance")) || data.doctors[0];
          }

          setSelectedDoctorId(bestDoc.id);
          setSelectedSlot(bestDoc.timeSlots?.[0] || "09:00 AM");
        }
      })
      .catch((err) => console.error("Failed to load doctors:", err));
  }, [triageResult]);

  const selectedDoctor = doctors.find((d) => d.id === selectedDoctorId);

  const specialties = ["All", "Emergency", "Cardiology", "Pulmonology", "Pediatrics", "Orthopedics", "General Medicine"];

  const filteredDoctors = doctors.filter((doc) => {
    const matchesSpec = specialtyFilter === "All" || doc.specialty.toLowerCase().includes(specialtyFilter.toLowerCase()) || doc.department.toLowerCase().includes(specialtyFilter.toLowerCase());
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase()) || doc.specialty.toLowerCase().includes(searchQuery.toLowerCase()) || doc.room.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSpec && matchesSearch;
  });

  const handleBookSlot = async () => {
    if (!selectedDoctorId || !selectedSlot) return;

    setBookingLoading(true);
    try {
      const checkedLabels = checklistItems.filter((i) => i.checked).map((i) => i.label);

      const res = await fetch("/api/appointments/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: currentUser.id,
          patientName: currentUser.name,
          patientEmail: currentUser.email,
          patientPhone: patientPhone || "(555) 000-0000",
          doctorId: selectedDoctorId,
          date: selectedDate,
          timeSlot: selectedSlot,
          urgencyLevel: triageResult?.triage_note?.urgency_level || 3,
          urgencyName: triageResult?.triage_note?.urgency_name || "Urgent Clinical Consultation",
          reason: bookingReason,
          checklistSummary: checkedLabels
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to book slot");

      setBookedAppointment(data.appointment);
      if (onBookingSuccess) onBookingSuccess(data.appointment);
    } catch (err: any) {
      alert(err.message || "Failed to book slot.");
    } finally {
      setBookingLoading(false);
    }
  };

  const handlePrintPass = () => {
    window.print();
  };

  const handleDownloadTicket = () => {
    if (!bookedAppointment) return;
    const content = `======================================================
HOSPITAL CLINICAL CONSULTATION APPOINTMENT PASS
======================================================
Ticket ID:      ${bookedAppointment.id}
Status:         ${bookedAppointment.status} (Confirmed)
Date & Time:    ${bookedAppointment.date} at ${bookedAppointment.timeSlot}
Priority Level: Level ${bookedAppointment.urgencyLevel} - ${bookedAppointment.urgencyName}

DOCTOR DETAILS:
Doctor:         ${bookedAppointment.doctorName}
Specialty:      ${bookedAppointment.doctorSpecialty}
Consultation:   ${bookedAppointment.doctorRoom}

PATIENT DETAILS:
Patient Name:   ${bookedAppointment.patientName}
Contact Email:  ${bookedAppointment.patientEmail}
Contact Phone:  ${bookedAppointment.patientPhone || "N/A"}

CLINICAL REASON & REPORTED SYMPTOMS:
${bookedAppointment.reason}

CHECKLIST FINDINGS VERIFIED:
${bookedAppointment.checklistSummary?.length ? bookedAppointment.checklistSummary.map((s, idx) => `  ${idx + 1}. ${s}`).join("\n") : "  None specified."}

ARRIVAL INSTRUCTIONS:
Please arrive 10 minutes prior to your scheduled time. Present this digital pass at Reception Desk 01 or directly to ${bookedAppointment.doctorRoom}.
======================================================`;

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Appointment_Pass_${bookedAppointment.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // If appointment confirmed, show high-contrast Consultation Pass
  if (bookedAppointment) {
    return (
      <div id="appointment_confirmed_view" className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="bg-emerald-600 text-white p-6 rounded-2xl shadow-lg flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-white">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-100">
                Slot Confirmed &amp; Stored in Hospital EHR
              </span>
              <h2 className="text-2xl font-bold tracking-tight">Doctor Appointment Booked!</h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn_print_ticket"
              onClick={handlePrintPass}
              className="px-3.5 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Pass</span>
            </button>
            <button
              type="button"
              id="btn_download_ticket"
              onClick={handleDownloadTicket}
              className="px-3.5 py-2 rounded-xl bg-white text-emerald-800 hover:bg-emerald-50 text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Ticket (.txt)</span>
            </button>
          </div>
        </div>

        {/* Digital Appointment Pass Card */}
        <div className="bg-white border-2 border-slate-900 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6 relative overflow-hidden">
          {/* Top Banner Ribbon */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-slate-200">
            <div>
              <span className="text-[11px] font-bold font-mono uppercase tracking-widest text-blue-600">
                OFFICIAL CONSULTATION PASS &bull; TICKET #{bookedAppointment.id.slice(-8).toUpperCase()}
              </span>
              <h3 className="text-xl font-black text-slate-900 mt-0.5">
                Hospital Clinical Intake Pass
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <span className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider ${
                bookedAppointment.urgencyLevel <= 2 
                  ? "bg-red-600 text-white" 
                  : bookedAppointment.urgencyLevel === 3 
                  ? "bg-amber-500 text-white" 
                  : "bg-emerald-600 text-white"
              }`}>
                Level {bookedAppointment.urgencyLevel} &bull; {bookedAppointment.urgencyName}
              </span>
            </div>
          </div>

          {/* Core Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Doctor Info */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Assigned Attending Clinician
              </span>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg">
                  <Stethoscope className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900">{bookedAppointment.doctorName}</h4>
                  <p className="text-xs font-semibold text-blue-600">{bookedAppointment.doctorSpecialty}</p>
                </div>
              </div>
              <div className="pt-2 flex items-center gap-1.5 text-xs text-slate-600">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                <span><strong>Location:</strong> {bookedAppointment.doctorRoom}</span>
              </div>
            </div>

            {/* Date & Time Slot */}
            <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                Scheduled Slot
              </span>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-700" />
                <span className="text-lg font-black text-slate-900">{bookedAppointment.date}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-700" />
                <span className="text-xl font-black text-blue-700">{bookedAppointment.timeSlot}</span>
              </div>
              <p className="text-[11px] text-blue-600/80">
                Please proceed directly to the station 10 minutes before this slot.
              </p>
            </div>
          </div>

          {/* Patient Details & Clinical Findings */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
              <div>
                <span className="text-slate-500">Patient: </span>
                <strong className="text-slate-900">{bookedAppointment.patientName}</strong>
              </div>
              <div>
                <span className="text-slate-500">Email: </span>
                <span className="text-slate-700">{bookedAppointment.patientEmail}</span>
              </div>
              <div>
                <span className="text-slate-500">Phone: </span>
                <span className="text-slate-700">{bookedAppointment.patientPhone || "N/A"}</span>
              </div>
            </div>

            <div className="text-xs border-t border-slate-200/80 pt-2">
              <span className="font-bold text-slate-700">Reason for Visit: </span>
              <span className="text-slate-600">{bookedAppointment.reason}</span>
            </div>

            {bookedAppointment.checklistSummary && bookedAppointment.checklistSummary.length > 0 && (
              <div className="text-xs border-t border-slate-200/80 pt-2">
                <span className="font-bold text-slate-700">Reported Checklist Findings:</span>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {bookedAppointment.checklistSummary.map((item, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-md bg-white border border-slate-300 text-[11px] text-slate-800 font-medium"
                    >
                      &bull; {item}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Bottom Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              id="btn_book_another_slot"
              onClick={() => setBookedAppointment(null)}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline transition cursor-pointer"
            >
              &larr; Book Another Appointment
            </button>

            {onViewRecords && (
              <button
                type="button"
                id="btn_view_my_records"
                onClick={onViewRecords}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition cursor-pointer"
              >
                <span>View My Records &amp; Appointments</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="doctor_booking_view" className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Top Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Book a Slot to Meet the Doctor
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Choose an available attending clinician, pick your date and preferred time slot, and receive an instant digital consultation pass.
          </p>
        </div>

        {triageResult && (
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-blue-600 shrink-0" />
            <div>
              <span className="font-bold text-blue-950">Triage Priority Applied:</span>{" "}
              <span className="text-blue-800 font-semibold">{triageResult.triage_note.urgency_name}</span>
              <div className="text-[11px] text-blue-600 mt-0.5">
                Target Department: {triageResult.triage_note.department}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Grid: Left Doctors List, Right Booking Configuration Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Doctor Selection (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                id="search_doctors"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search doctors by name, specialty, or room..."
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 text-xs text-slate-800"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {specialties.map((spec) => (
                <button
                  key={spec}
                  type="button"
                  onClick={() => setSpecialtyFilter(spec)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                    specialtyFilter === spec
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                  }`}
                >
                  {spec}
                </button>
              ))}
            </div>
          </div>

          {/* Doctor Cards */}
          <div className="space-y-3">
            {filteredDoctors.map((doc) => {
              const isSelected = doc.id === selectedDoctorId;
              const isRecommended = triageResult?.facts?.complaint_family === "chest_pain" && doc.id.includes("vance");

              return (
                <div
                  key={doc.id}
                  id={`doc_card_${doc.id}`}
                  onClick={() => {
                    setSelectedDoctorId(doc.id);
                    if (doc.timeSlots?.length) {
                      setSelectedSlot(doc.timeSlots[0]);
                    }
                  }}
                  className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                    isSelected
                      ? "bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/20 shadow-md"
                      : "bg-white hover:bg-slate-50/80 border-slate-200 shadow-xs"
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    <img
                      src={doc.avatar}
                      alt={doc.name}
                      className="w-14 h-14 rounded-2xl object-cover border border-slate-200 shrink-0"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-slate-900">{doc.name}</h3>
                        {isRecommended && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                            Recommended for Chest Pain
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-blue-600">{doc.specialty}</p>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {doc.room}
                        </span>
                        <span className="flex items-center gap-1 text-amber-600 font-bold">
                          <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                          {doc.rating} ({doc.experienceYears} yrs exp)
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-1">{doc.bio}</p>
                    </div>
                  </div>

                  <div className="shrink-0 flex sm:flex-col items-end gap-2 w-full sm:w-auto justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0">
                    <span className="text-[11px] text-slate-400">
                      {doc.timeSlots.length} available slots
                    </span>
                    <button
                      type="button"
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        isSelected
                          ? "bg-blue-600 text-white shadow-xs"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {isSelected ? "Selected" : "Select Doctor"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Booking Details & Slot Selection (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-5 sticky top-20">
            <div>
              <h3 className="text-base font-bold text-slate-900">Select Date &amp; Time Slot</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Lock in your appointment with {selectedDoctor?.name || "your doctor"}.
              </p>
            </div>

            {/* Date Picker Buttons */}
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase font-bold text-slate-400">Consultation Date</label>
              <div className="grid grid-cols-3 gap-2">
                {["Today", "Tomorrow", "Next Available"].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSelectedDate(d)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer border ${
                      selectedDate === d
                        ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                        : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Time Slot Picker */}
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase font-bold text-slate-400">Available Time Slots</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[160px] overflow-y-auto pr-1">
                {(selectedDoctor?.timeSlots || ["09:00 AM", "09:30 AM", "10:15 AM", "11:00 AM", "02:00 PM", "03:15 PM"]).map((slot) => {
                  const isSlotActive = selectedSlot === slot;
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      className={`py-2 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer border ${
                        isSlotActive
                          ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                          : "bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border-slate-200"
                      }`}
                    >
                      <Clock className="w-3 h-3" />
                      <span>{slot}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Patient Contact Info */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Contact Phone Number
                </label>
                <input
                  type="text"
                  id="input_booking_phone"
                  value={patientPhone}
                  onChange={(e) => setPatientPhone(e.target.value)}
                  placeholder="e.g. (555) 234-5678"
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 text-slate-800"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Visit Reason / Symptom Note
                </label>
                <textarea
                  id="input_booking_reason"
                  rows={2}
                  value={bookingReason}
                  onChange={(e) => setBookingReason(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 text-slate-800"
                />
              </div>
            </div>

            {/* Selected Checklist Items Summary */}
            {checklistItems.some((i) => i.checked) && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <span className="font-bold text-slate-700 block text-[11px]">
                  Attaching {checklistItems.filter((i) => i.checked).length} Checklist Findings:
                </span>
                <p className="text-[11px] text-slate-500 line-clamp-2">
                  {checklistItems.filter((i) => i.checked).map((i) => i.label).join(", ")}
                </p>
              </div>
            )}

            {/* Confirm Button */}
            <button
              type="button"
              id="btn_confirm_doctor_booking"
              disabled={bookingLoading || !selectedDoctorId || !selectedSlot}
              onClick={handleBookSlot}
              className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {bookingLoading ? (
                <span>Securing Slot...</span>
              ) : (
                <>
                  <span>Confirm &amp; Book Consultation Slot</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
