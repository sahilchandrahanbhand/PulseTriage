export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  station: string;
  avatar: string;
  accountType?: "patient" | "staff";
  phone?: string;
  age?: number | string;
  gender?: string;
  medicalConditions?: string;
  allergies?: string;
  specialty?: string;
  licenseNumber?: string;
}

export interface ChecklistItem {
  id: string;
  category: "symptom" | "onset" | "red_flag" | "custom";
  label: string;
  checked: boolean;
  severity?: "mild" | "moderate" | "severe";
  details?: string;
}

export interface ChatMessage {
  id: string;
  sender: "assistant" | "user";
  text: string;
  timestamp: string;
  suggestions?: string[];
  isTriageSummary?: boolean;
}

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  department: string;
  room: string;
  avatar: string;
  rating: number;
  experienceYears: number;
  bio: string;
  availableDays: string[];
  timeSlots: string[];
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  patientEmail: string;
  patientPhone?: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialty: string;
  doctorRoom: string;
  date: string;
  timeSlot: string;
  urgencyLevel: number;
  urgencyName: string;
  reason: string;
  checklistSummary: string[];
  status: "Confirmed" | "In Consultation" | "Completed" | "Cancelled";
  createdAt: string;
}

export interface IntakeRecord {
  id: string;
  patientId: string;
  patientName: string;
  patientEmail: string;
  timestamp: string;
  patientDescription: string;
  checklistItems: string[];
  facts: ClinicalFacts;
  triageNote: TriageNote;
}

export interface RedFlags {
  diaphoresis?: boolean | null;
  radiation_arm_jaw?: boolean | null;
  shortness_of_breath?: boolean | null;
  crushing_pressure?: boolean | null;
  pleuritic_worsening?: boolean | null;
  reproducible_on_palpation?: boolean | null;
  cyanosis?: boolean | null;
  stridor?: boolean | null;
  unable_to_speak_sentences?: boolean | null;
  asthma_or_copd?: boolean | null;
  stiff_neck?: boolean | null;
  petechial_rash?: boolean | null;
  dehydration_or_vomiting?: boolean | null;
  high_energy_trauma?: boolean | null;
  active_bleeding?: boolean | null;
  loss_of_consciousness?: boolean | null;
  cannot_bear_weight?: boolean | null;
  rigid_abdomen?: boolean | null;
  syncope?: boolean | null;
  focal_rlq_or_ruq?: boolean | null;
  [key: string]: boolean | null | undefined;
}

export interface FollowUpQuestion {
  id: string;
  question: string;
  field: string;
  explanation?: string;
}

export interface ClinicalFacts {
  complaint_family: "chest_pain" | "breathing_difficulty" | "fever" | "injury" | "abdominal_pain" | "general_escalation" | string;
  symptoms: string[];
  duration_days: number;
  age_years: number | null;
  age_months: number | null;
  red_flags: RedFlags;
  what_patient_reported: string[];
  what_followups_established: string[];
  what_remains_unknown: string[];
  recommended_follow_up_questions?: FollowUpQuestion[];
}

export interface TriageRecommendation {
  rule_id: string;
  urgency_level: 1 | 2 | 3 | 4 | 5;
  urgency_name: string;
  department: string;
  escalate_to_human: boolean;
  citation_text: string;
  reasoning: string;
}

export interface TriageNote {
  track_id: string;
  urgency_level: 1 | 2 | 3 | 4 | 5;
  urgency_name: string;
  department: string;
  rule_id: string;
  citation_text: string;
  escalate_to_human: boolean;
  reasoning?: string;
  what_patient_reported: string[];
  what_followups_established: string[];
  what_remains_unknown: string[];
  disclaimer: string;
}

export interface TriageResult {
  facts: ClinicalFacts;
  recommendation: TriageRecommendation;
  triage_note: TriageNote;
}

export interface ProtocolRule {
  rule_id: string;
  complaint_family: string;
  title: string;
  urgency_level: number;
  urgency_name: string;
  department: string;
  escalate_to_human: boolean;
  triggers: string[];
  required_checks: string[];
  citation_text: string;
}

export interface RulesKnowledgeBase {
  version: string;
  track_id: string;
  name: string;
  disclaimer: string;
  urgency_levels: {
    level: number;
    name: string;
    max_wait_minutes: number;
    color: string;
    description: string;
  }[];
  departments: string[];
  rules: ProtocolRule[];
}
