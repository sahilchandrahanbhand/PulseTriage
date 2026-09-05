import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";

const app = express();

// In development, dev server strictly binds to port 3000 behind the nginx container proxy.
// In production (Cloud Run), the container must listen on the port injected by Cloud Run (process.env.PORT, default 8080).
const PORT = process.env.NODE_ENV === "production"
  ? (process.env.PORT ? parseInt(process.env.PORT, 10) : 3000)
  : 3000;

app.use(express.json());

// User Sessions & Persistent Data Models
interface AppUser {
  id: string;
  name: string;
  email: string;
  role: string;
  station: string;
  avatar: string;
  accountType: "patient" | "staff";
  password?: string;
  phone?: string;
  age?: number | string;
  gender?: string;
  medicalConditions?: string;
  allergies?: string;
  specialty?: string;
  licenseNumber?: string;
}

const SESSIONS = new Map<string, { token: string; user: AppUser; expiresAt: number }>();

// Resilient data storage path: prefer cwd/data, fallback to /tmp/data if read-only
function resolveDataDir(): string {
  const localData = path.join(process.cwd(), "data");
  try {
    if (!fs.existsSync(localData)) {
      fs.mkdirSync(localData, { recursive: true });
    }
    const testFile = path.join(localData, ".write_check");
    fs.writeFileSync(testFile, "ok", "utf-8");
    fs.unlinkSync(testFile);
    return localData;
  } catch (e) {
    const tmpData = path.join("/tmp", "carepal-data");
    if (!fs.existsSync(tmpData)) {
      try {
        fs.mkdirSync(tmpData, { recursive: true });
      } catch (err) {}
    }
    return tmpData;
  }
}

const DATA_DIR = resolveDataDir();
const USERS_FILE = path.join(DATA_DIR, "users.json");
const DOCTORS_FILE = path.join(DATA_DIR, "doctors.json");
const INTAKES_FILE = path.join(DATA_DIR, "intakes.json");
const APPOINTMENTS_FILE = path.join(DATA_DIR, "appointments.json");

const DEFAULT_DEMO_USERS: AppUser[] = [
  {
    id: "staff-01",
    name: "Nurse Sarah Chen, BSN, RN",
    email: "sarah.chen@hospital.org",
    role: "Triage Staff Nurse",
    station: "Intake Desk 01",
    avatar: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&auto=format&fit=crop&q=80",
    accountType: "staff",
    specialty: "Emergency & Triage Nursing",
    password: "HospitalSafe2026!"
  },
  {
    id: "staff-02",
    name: "Dr. Marcus Vance, MD",
    email: "marcus.vance@hospital.org",
    role: "Emergency Attending",
    station: "Resuscitation Bay Lead",
    avatar: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150&auto=format&fit=crop&q=80",
    accountType: "staff",
    specialty: "Emergency Medicine",
    licenseNumber: "MD-94812",
    password: "HospitalSafe2026!"
  },
  {
    id: "staff-03",
    name: "Alex Rivera",
    email: "alex.rivera@hospital.org",
    role: "Patient Access Specialist",
    station: "Registration & Ambulatory Triage",
    avatar: "https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=150&auto=format&fit=crop&q=80",
    accountType: "staff",
    password: "HospitalSafe2026!"
  },
  {
    id: "patient-01",
    name: "Emma Watson",
    email: "emma.watson@patient.com",
    role: "Patient",
    station: "Outpatient / Walk-in",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80",
    accountType: "patient",
    phone: "(555) 234-5678",
    age: 34,
    gender: "Female",
    allergies: "Penicillin",
    medicalConditions: "Mild asthma",
    password: "HospitalSafe2026!"
  }
];

const DEFAULT_DOCTORS = [
  {
    id: "doc-vance",
    name: "Dr. Marcus Vance, MD",
    specialty: "Emergency Medicine & Trauma",
    department: "Emergency Department",
    room: "Resuscitation Bay Lead / Desk 01",
    avatar: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=200&auto=format&fit=crop&q=80",
    rating: 4.9,
    experienceYears: 16,
    bio: "Chief of Emergency Services specializing in acute cardiac care, high-acuity trauma, and rapid triage stabilization.",
    availableDays: ["Today", "Tomorrow", "Wednesday", "Thursday"],
    timeSlots: ["09:00 AM", "09:30 AM", "10:15 AM", "11:00 AM", "02:00 PM", "03:15 PM", "04:30 PM", "05:15 PM"]
  },
  {
    id: "doc-rostova",
    name: "Dr. Elena Rostova, MD, FACC",
    specialty: "Cardiology & Vascular Medicine",
    department: "Cardiology Center",
    room: "Heart Institute, Room 302",
    avatar: "https://images.unsplash.com/photo-1594824813589-32219468e821?w=200&auto=format&fit=crop&q=80",
    rating: 4.95,
    experienceYears: 14,
    bio: "Interventional cardiologist leading the Rapid Chest Pain & Arrhythmia evaluation unit.",
    availableDays: ["Today", "Tomorrow", "Thursday", "Friday"],
    timeSlots: ["10:00 AM", "11:30 AM", "01:30 PM", "02:45 PM", "04:00 PM"]
  },
  {
    id: "doc-patel",
    name: "Dr. Rajiv Patel, MD, FCCP",
    specialty: "Pulmonology & Respiratory Care",
    department: "Respiratory Center",
    room: "Pulmonary Clinic, Suite 210",
    avatar: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=200&auto=format&fit=crop&q=80",
    rating: 4.88,
    experienceYears: 12,
    bio: "Specialist in acute respiratory distress, severe asthma flares, COPD management, and post-viral lung care.",
    availableDays: ["Today", "Tomorrow", "Friday"],
    timeSlots: ["09:15 AM", "10:30 AM", "11:45 AM", "02:15 PM", "03:45 PM"]
  },
  {
    id: "doc-lin",
    name: "Dr. Maya Lin, MD, FAAP",
    specialty: "Pediatrics & Child Health",
    department: "Pediatric Care",
    room: "Children's Health Pavilion, Wing B",
    avatar: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=200&auto=format&fit=crop&q=80",
    rating: 4.97,
    experienceYears: 11,
    bio: "Dedicated pediatric specialist focusing on infant fever evaluation, pediatric respiratory infections, and gentle care.",
    availableDays: ["Today", "Tomorrow", "Wednesday"],
    timeSlots: ["08:30 AM", "09:45 AM", "11:00 AM", "01:00 PM", "03:00 PM", "04:15 PM"]
  },
  {
    id: "doc-wilson",
    name: "Dr. James Wilson, MD",
    specialty: "Orthopedics & Sports Trauma",
    department: "Orthopedic Surgery",
    room: "Bone & Joint Center, Clinic 105",
    avatar: "https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=200&auto=format&fit=crop&q=80",
    rating: 4.85,
    experienceYears: 15,
    bio: "Board-certified orthopedic surgeon managing acute joint fractures, weight-bearing sprains, and rapid immobilization.",
    availableDays: ["Today", "Tomorrow", "Thursday"],
    timeSlots: ["10:15 AM", "11:30 AM", "02:00 PM", "03:30 PM", "04:45 PM"]
  },
  {
    id: "doc-martinez",
    name: "Dr. Sophia Martinez, MD",
    specialty: "Internal & Family Medicine",
    department: "General Medicine",
    room: "Ambulatory Health Wing, Desk 04",
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80",
    rating: 4.92,
    experienceYears: 9,
    bio: "Compassionate general practitioner providing comprehensive physical evaluations, acute illness relief, and patient advocacy.",
    availableDays: ["Today", "Tomorrow", "Wednesday", "Friday"],
    timeSlots: ["09:00 AM", "10:00 AM", "11:15 AM", "01:45 PM", "03:00 PM", "04:30 PM", "05:30 PM"]
  }
];

// Helper functions for persistent JSON data
function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(content) as T;
    }
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
  }
  return fallback;
}

function writeJsonFile(filePath: string, data: any): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
  }
}

// Seed initial files if missing
if (!fs.existsSync(USERS_FILE)) {
  writeJsonFile(USERS_FILE, DEFAULT_DEMO_USERS);
}
if (!fs.existsSync(DOCTORS_FILE)) {
  writeJsonFile(DOCTORS_FILE, DEFAULT_DOCTORS);
}
if (!fs.existsSync(INTAKES_FILE)) {
  writeJsonFile(INTAKES_FILE, []);
}
if (!fs.existsSync(APPOINTMENTS_FILE)) {
  writeJsonFile(APPOINTMENTS_FILE, []);
}

// Load knowledge base rules
let triageRulesData: any = null;
try {
  const possiblePaths = [
    path.join(process.cwd(), "data", "triage_rules.json"),
    path.join(DATA_DIR, "triage_rules.json"),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      triageRulesData = JSON.parse(fs.readFileSync(p, "utf-8"));
      break;
    }
  }
} catch (err) {
  console.error("Error reading triage_rules.json:", err);
}

// Lazy Gemini client helper
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    geminiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return geminiClient;
}

// Resilient Gemini calling with retry on 503/429 and automatic model cascade
async function generateContentWithFallback(ai: GoogleGenAI, request: { contents: any; config?: any }) {
  const models = [
    process.env.GEMINI_MODEL || "gemini-3.8-flash",
    "gemini-3.1-flash-lite",
    "gemini-flash-latest"
  ];
  const uniqueModels = Array.from(new Set(models.filter(Boolean)));
  let lastError: any = null;

  for (const model of uniqueModels) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: request.contents,
          config: request.config,
        });
        if (response && response.text) {
          return { response, modelUsed: model };
        }
      } catch (err: any) {
        lastError = err;
        const errMsg = err?.message || String(err);
        const isUnavailableOrRateLimited =
          errMsg.includes("503") ||
          errMsg.includes("UNAVAILABLE") ||
          errMsg.includes("high demand") ||
          errMsg.includes("429") ||
          errMsg.includes("RESOURCE_EXHAUSTED");

        if (isUnavailableOrRateLimited && attempt === 0) {
          // Brief pause for demand spike
          await new Promise((resolve) => setTimeout(resolve, 600));
          continue;
        }

        // Move to next fallback model in cascade
        break;
      }
    }
  }

  throw lastError || new Error("All Gemini model endpoints currently unavailable");
}

// Deterministic Rule Evaluator
function evaluateRules(facts: any) {
  const family = facts.complaint_family || "general_escalation";
  const symptoms: string[] = (facts.symptoms || []).map((s: string) => s.toLowerCase());
  const flags = facts.red_flags || {};
  const ageMonths = facts.age_months;
  const ageYears = facts.age_years;
  const durationDays = facts.duration_days || 0;

  // 1. Chest pain
  if (family === "chest_pain") {
    const hasSweating = flags.diaphoresis === true || symptoms.some(s => s.includes("sweat"));
    const hasRadiation = flags.radiation_arm_jaw === true || symptoms.some(s => s.includes("arm") || s.includes("jaw") || s.includes("radiat"));
    const hasDyspnea = flags.shortness_of_breath === true || symptoms.some(s => s.includes("breath") || s.includes("short"));
    const isCrushing = flags.crushing_pressure === true || symptoms.some(s => s.includes("crush") || s.includes("heavy") || s.includes("tight") || s.includes("elephant"));

    if (hasSweating || hasRadiation || (isCrushing && hasDyspnea)) {
      return {
        rule_id: "R-CHEST-01",
        urgency_level: 1,
        urgency_name: "Immediate (Resuscitation)",
        department: "Emergency Resuscitation Bay",
        escalate_to_human: true,
        citation_text: "Protocol R-CHEST-01: Chest pain or pressure accompanied by autonomic symptoms (diaphoresis), pain radiation to upper extremity/jaw, or respiratory distress carries high suspicion of Acute Coronary Syndrome (ACS) and requires immediate Resuscitation Bay routing and immediate human clinical assessment without diagnostic delay.",
        reasoning: "High-risk cardiac red flags present: chest pressure combined with sweating/radiation/shortness of breath."
      };
    }

    const hasPleuritic = flags.pleuritic_worsening === true || symptoms.some(s => s.includes("breath") && s.includes("worse") || s.includes("sharp"));
    if (hasPleuritic) {
      return {
        rule_id: "R-CHEST-02",
        urgency_level: 2,
        urgency_name: "Emergent",
        department: "Emergency Department - Acute Assessment",
        escalate_to_human: true,
        citation_text: "Protocol R-CHEST-02: Acute sharp pleuritic chest discomfort warrants urgent rule-out for pulmonary thromboembolism, spontaneous pneumothorax, or acute pericarditis. Requires 12-lead ECG and immediate physician evaluation.",
        reasoning: "Sharp pleuritic chest discomfort requiring emergent diagnostic evaluation."
      };
    }

    const isReproducible = flags.reproducible_on_palpation === true || symptoms.some(s => s.includes("press") || s.includes("touch") || s.includes("muscl"));
    if (isReproducible && !hasDyspnea && !hasSweating) {
      return {
        rule_id: "R-CHEST-03",
        urgency_level: 4,
        urgency_name: "Less Urgent",
        department: "Urgent Care Clinic",
        escalate_to_human: false,
        citation_text: "Protocol R-CHEST-03: Localized chest pain strictly reproducible by direct chest wall palpation with negative cardiovascular screens (no radiation, no diaphoresis, no dyspnea) is suitable for Urgent Care evaluation.",
        reasoning: "Reproducible musculoskeletal chest pain with negative cardiac screens."
      };
    }
  }

  // 2. Breathing difficulty
  if (family === "breathing_difficulty") {
    const severeAirway = flags.cyanosis === true || flags.stridor === true || flags.unable_to_speak_sentences === true ||
      symptoms.some(s => s.includes("blue") || s.includes("chok") || s.includes("stridor") || s.includes("gasp") || s.includes("can't speak"));
    if (severeAirway) {
      return {
        rule_id: "R-BREATH-01",
        urgency_level: 1,
        urgency_name: "Immediate (Resuscitation)",
        department: "Emergency Resuscitation Bay",
        escalate_to_human: true,
        citation_text: "Protocol R-BREATH-01: Inability to speak in full sentences, cyanosis, audible stridor, or severe work of breathing indicates impending respiratory failure. Requires immediate code/resuscitation allocation and airway team standby.",
        reasoning: "Critical airway or ventilatory distress detected."
      };
    }

    const hasWheeze = flags.asthma_or_copd === true || symptoms.some(s => s.includes("asthma") || s.includes("wheez") || s.includes("inhaler"));
    if (hasWheeze) {
      return {
        rule_id: "R-BREATH-02",
        urgency_level: 2,
        urgency_name: "Emergent",
        department: "Emergency Department - Acute Assessment",
        escalate_to_human: true,
        citation_text: "Protocol R-BREATH-02: Acute bronchospasm unresponsive to rescue bronchodilators or dyspnea complicated by underlying cardiopulmonary history warrants emergent ED assessment and nebulized therapy.",
        reasoning: "Acute bronchospasm or respiratory distress with underlying pulmonary history."
      };
    }

    return {
      rule_id: "R-BREATH-03",
      urgency_level: 4,
      urgency_name: "Less Urgent",
      department: "Emergency Department - Fast Track",
      escalate_to_human: false,
      citation_text: "Protocol R-BREATH-03: Mild upper respiratory symptoms with normal conversational capability, no resting tachypnea, and no accessory muscle utilization routed to Fast Track.",
      reasoning: "Mild respiratory symptoms with intact conversational speech."
    };
  }

  // 3. Fever
  if (family === "fever") {
    const isNeonate = (ageMonths !== null && ageMonths !== undefined && ageMonths < 3) || (ageYears === 0);
    const hasMeningeal = flags.stiff_neck === true || flags.petechial_rash === true || symptoms.some(s => s.includes("stiff neck") || s.includes("rash") || s.includes("purple"));

    if (isNeonate || hasMeningeal) {
      return {
        rule_id: "R-FEVER-01",
        urgency_level: 2,
        urgency_name: "Emergent",
        department: isNeonate ? "Pediatric Emergency" : "Emergency Department - Acute Assessment",
        escalate_to_human: true,
        citation_text: "Protocol R-FEVER-01: Fever in neonates (<90 days) or fever combined with meningeal signs (stiff neck, photophobia) or non-blanching rash requires immediate emergent routing for sepsis/meningitis workup and direct physician escalation.",
        reasoning: "High-risk fever red flag (infant < 3 months or meningeal signs)."
      };
    }

    const hasDehydration = flags.dehydration_or_vomiting === true || durationDays >= 3 || symptoms.some(s => s.includes("vomit") || s.includes("dehydrat") || s.includes("can't drink"));
    if (hasDehydration) {
      return {
        rule_id: "R-FEVER-02",
        urgency_level: 3,
        urgency_name: "Urgent",
        department: "Emergency Department - Acute Assessment",
        escalate_to_human: false,
        citation_text: "Protocol R-FEVER-02: Prolonged fever with signs of systemic dehydration or inability to maintain oral hydration warrants Urgent care for intravenous fluid rehydration and lab investigation.",
        reasoning: "Fever with inability to tolerate oral fluids or duration exceeding 72 hours."
      };
    }

    return {
      rule_id: "R-FEVER-03",
      urgency_level: 4,
      urgency_name: "Less Urgent",
      department: "Walk-In Ambulatory Clinic",
      escalate_to_human: false,
      citation_text: "Protocol R-FEVER-03: Mild-to-moderate fever of short duration (<3 days) in an alert, well-hydrated adult with no high-risk comorbidities or focal signs routes to Walk-In Ambulatory Clinic.",
      reasoning: "Uncomplicated short-duration fever in hydrated alert patient."
    };
  }

  // 4. Injury
  if (family === "injury") {
    const isMajorTrauma = flags.high_energy_trauma === true || flags.active_bleeding === true || flags.loss_of_consciousness === true ||
      symptoms.some(s => s.includes("crash") || s.includes("bleeding heavily") || s.includes("blacked out") || s.includes("passed out") || s.includes("fall from"));
    if (isMajorTrauma) {
      return {
        rule_id: "R-INJURY-01",
        urgency_level: 1,
        urgency_name: "Immediate (Resuscitation)",
        department: "Emergency Resuscitation Bay",
        escalate_to_human: true,
        citation_text: "Protocol R-INJURY-01: High-energy kinetic mechanism, penetrative trauma, pulseless injured extremity, or uncontrolled bleeding triggers Level 1 Resuscitation and immediate trauma team activation.",
        reasoning: "High-energy trauma mechanism, active hemorrhage, or impaired consciousness."
      };
    }

    const cannotBearWeight = flags.cannot_bear_weight === true || symptoms.some(s => s.includes("can't walk") || s.includes("cannot bear weight") || s.includes("fracture") || s.includes("swollen"));
    if (cannotBearWeight) {
      return {
        rule_id: "R-INJURY-02",
        urgency_level: 3,
        urgency_name: "Urgent",
        department: "Urgent Care Orthopedics / Fast Track",
        escalate_to_human: false,
        citation_text: "Protocol R-INJURY-02: Isolated extremity trauma with positive weight-bearing deficit or bony focal tenderness (Ottawa rules positive) requires radiographic imaging and orthopedic evaluation.",
        reasoning: "Ottawa rules positive: inability to bear weight or focal bone tenderness."
      };
    }

    return {
      rule_id: "R-INJURY-03",
      urgency_level: 5,
      urgency_name: "Non-Urgent",
      department: "Walk-In Ambulatory Clinic",
      escalate_to_human: false,
      citation_text: "Protocol R-INJURY-03: Low-velocity superficial soft tissue trauma with full mobility and preserved neurovascular integrity routes to Walk-In Ambulatory Clinic.",
      reasoning: "Minor soft tissue injury with intact mobility."
    };
  }

  // 5. Abdominal pain
  if (family === "abdominal_pain") {
    const isSevereSurgical = flags.rigid_abdomen === true || flags.syncope === true || flags.vomiting_blood === true ||
      symptoms.some(s => s.includes("rigid") || s.includes("board-like") || s.includes("passed out") || s.includes("blood"));
    if (isSevereSurgical) {
      return {
        rule_id: "R-ABDOM-01",
        urgency_level: 1,
        urgency_name: "Immediate (Resuscitation)",
        department: "Emergency Resuscitation Bay",
        escalate_to_human: true,
        citation_text: "Protocol R-ABDOM-01: Acute severe abdomen presenting with involuntary rigidity, hemodynamic collapse, active GI hemorrhage, or suspected ruptured ectopic pregnancy triggers immediate emergency surgical evaluation.",
        reasoning: "Peritoneal signs, rigid abdomen, or hemodynamic instability."
      };
    }

    const isFocal = flags.focal_rlq_or_ruq === true || symptoms.some(s => s.includes("right side") || s.includes("lower right") || s.includes("appendix"));
    if (isFocal) {
      return {
        rule_id: "R-ABDOM-02",
        urgency_level: 3,
        urgency_name: "Urgent",
        department: "Emergency Department - Acute Assessment",
        escalate_to_human: true,
        citation_text: "Protocol R-ABDOM-02: Progressive focal abdominal pain with migration to RLQ or RUQ warrants urgent diagnostic laboratory and ultrasound/CT imaging for acute appendicitis, cholecystitis, or nephrolithiasis.",
        reasoning: "Focal migrating abdominal pain suspicious for appendicitis or cholecystitis."
      };
    }

    return {
      rule_id: "R-ABDOM-03",
      urgency_level: 4,
      urgency_name: "Less Urgent",
      department: "Urgent Care Clinic",
      escalate_to_human: false,
      citation_text: "Protocol R-ABDOM-03: Mild crampy abdominal discomfort without focal tenderness, peritoneal signs, or bloody stool is appropriate for outpatient or urgent care symptomatic management.",
      reasoning: "Mild diffuse non-surgical abdominal discomfort."
    };
  }

  // 6. Default Fallback Escalation
  return {
    rule_id: "R-ESCALATE-01",
    urgency_level: 2,
    urgency_name: "Emergent",
    department: "Emergency Department - Acute Assessment",
    escalate_to_human: true,
    citation_text: "Protocol R-ESCALATE-01: The triage system identified critical informational gaps or elevated risk indicators that cannot be safely reconciled by outpatient heuristic rules. Mandated immediate bedside triage nurse or physician evaluation.",
    reasoning: "Case requires human clinical evaluation due to ambiguous or high-risk features."
  };
}

// Offline fallback fact extractor
function fallbackExtractFacts(patientText: string, followUpAnswers: Record<string, any> = {}) {
  const text = (patientText || "").toLowerCase();
  let family = "general_escalation";
  if (text.includes("chest") || text.includes("heart") || text.includes("angina")) family = "chest_pain";
  else if (text.includes("breath") || text.includes("wheez") || text.includes("air") || text.includes("chok")) family = "breathing_difficulty";
  else if (text.includes("fever") || text.includes("temp") || text.includes("chills") || text.includes("hot")) family = "fever";
  else if (text.includes("ankle") || text.includes("twisted") || text.includes("fall") || text.includes("injury") || text.includes("cut") || text.includes("wound")) family = "injury";
  else if (text.includes("stomach") || text.includes("belly") || text.includes("abdominal") || text.includes("cramp")) family = "abdominal_pain";

  const flags: Record<string, any> = {};
  flags.diaphoresis = text.includes("sweat") || followUpAnswers.diaphoresis === true;
  flags.radiation_arm_jaw = text.includes("arm") || text.includes("jaw") || text.includes("radiat") || followUpAnswers.radiation_arm_jaw === true;
  flags.shortness_of_breath = text.includes("breath") || text.includes("winded") || followUpAnswers.shortness_of_breath === true;
  flags.crushing_pressure = text.includes("crush") || text.includes("elephant") || text.includes("heavy") || text.includes("tight") || followUpAnswers.crushing_pressure === true;
  flags.cannot_bear_weight = text.includes("can't walk") || text.includes("cannot bear weight") || followUpAnswers.cannot_bear_weight === true;
  flags.stiff_neck = text.includes("stiff neck") || followUpAnswers.stiff_neck === true;
  flags.rigid_abdomen = text.includes("rigid") || followUpAnswers.rigid_abdomen === true;

  const reported = [patientText.trim()];
  const established = Object.entries(followUpAnswers).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v ? "Yes" : "No"}`);
  const unknown: string[] = [];

  if (family === "chest_pain" && followUpAnswers.radiation_arm_jaw === undefined && !flags.radiation_arm_jaw) {
    unknown.push("Pain radiation to arm, neck, or jaw");
  }
  if (family === "chest_pain" && followUpAnswers.diaphoresis === undefined && !flags.diaphoresis) {
    unknown.push("Autonomic symptoms (cold sweating / diaphoresis)");
  }
  if (family === "fever" && followUpAnswers.stiff_neck === undefined) {
    unknown.push("Meningeal signs (neck stiffness, photophobia)");
  }
  if (family === "fever" && followUpAnswers.patient_age === undefined) {
    unknown.push("Exact patient age / pediatric status");
  }
  if (family === "injury" && followUpAnswers.cannot_bear_weight === undefined) {
    unknown.push("Ability to bear weight (Ottawa ankle/knee rules)");
  }

  const followUps: any[] = [];
  if (family === "chest_pain" && followUpAnswers.radiation_arm_jaw === undefined) {
    followUps.push({
      id: "radiation_arm_jaw",
      question: "Does the chest discomfort or pain spread or radiate to your left arm, shoulder, neck, or jaw?",
      field: "radiation_arm_jaw"
    });
  }
  if (family === "chest_pain" && followUpAnswers.diaphoresis === undefined) {
    followUps.push({
      id: "diaphoresis",
      question: "Did you break out in a sudden cold sweat, or feel clammy and nauseated?",
      field: "diaphoresis"
    });
  }
  if (family === "fever" && followUpAnswers.stiff_neck === undefined) {
    followUps.push({
      id: "stiff_neck",
      question: "Do you have stiffness in your neck when bending your chin to your chest, or sensitivity to bright lights?",
      field: "stiff_neck"
    });
  }
  if (family === "injury" && followUpAnswers.cannot_bear_weight === undefined) {
    followUps.push({
      id: "cannot_bear_weight",
      question: "Were you able to take 4 weight-bearing steps immediately after the injury, or can you stand now?",
      field: "cannot_bear_weight"
    });
  }
  if (family === "breathing_difficulty" && followUpAnswers.unable_to_speak_sentences === undefined) {
    followUps.push({
      id: "unable_to_speak_sentences",
      question: "Are you struggling to finish a complete sentence without needing to pause for air?",
      field: "unable_to_speak_sentences"
    });
  }

  return {
    complaint_family: family,
    symptoms: patientText.split(/[,.\n;]/).map(s => s.trim()).filter(s => s.length > 2),
    duration_days: 1,
    age_years: null,
    age_months: null,
    red_flags: flags,
    what_patient_reported: reported,
    what_followups_established: established,
    what_remains_unknown: unknown,
    recommended_follow_up_questions: followUps
  };
}

// Gemini Fact Extraction
async function extractFactsWithGemini(patientText: string, followUpAnswers: Record<string, any> = {}) {
  const ai = getGeminiClient();
  if (!ai) {
    return fallbackExtractFacts(patientText, followUpAnswers);
  }

  const prompt = `
  You are an emergency intake triage fact extractor.
  Your task is strictly to parse the patient's plain language statement and any established follow-up answers into structured clinical facts.
  DO NOT ASSIGN DIAGNOSES OR URGENCY LEVELS.

  Patient Statement:
  "${patientText}"

  Established Follow-up Answers (if any):
  ${JSON.stringify(followUpAnswers)}

  Extract:
  1. complaint_family: one of ["fever", "injury", "chest_pain", "breathing_difficulty", "abdominal_pain", "general_escalation"]
  2. symptoms: array of string symptoms
  3. duration_days: number (or 0)
  4. age_years: number or null
  5. age_months: number or null
  6. red_flags: boolean or null for each:
     - diaphoresis
     - radiation_arm_jaw
     - shortness_of_breath
     - crushing_pressure
     - pleuritic_worsening
     - reproducible_on_palpation
     - cyanosis
     - stridor
     - unable_to_speak_sentences
     - asthma_or_copd
     - stiff_neck
     - petechial_rash
     - dehydration_or_vomiting
     - high_energy_trauma
     - active_bleeding
     - loss_of_consciousness
     - cannot_bear_weight
     - rigid_abdomen
     - syncope
     - focal_rlq_or_ruq
  7. what_patient_reported: list of key points explicitly stated by patient
  8. what_followups_established: list of findings confirmed or denied in follow-up answers
  9. what_remains_unknown: critical parameters or red flags still unknown or not answered
  10. recommended_follow_up_questions: list of { id, question, field } asking targeted clinical questions for any high-risk screens that remain unknown.

  Respond with valid JSON only.
  `;

  try {
    const result = await generateContentWithFallback(ai, {
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(result.response.text || "{}");
    return parsed;
  } catch (err: any) {
    console.warn("Gemini service unavailable, switching seamlessly to protocol rule extractor:", err?.message || err);
    return fallbackExtractFacts(patientText, followUpAnswers);
  }
}

// ----------------------------------------------------
// API & HEALTH ROUTES
// ----------------------------------------------------

// Standard Kubernetes & Cloud Run health check endpoints
app.get(["/health", "/healthz", "/_health"], (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    track_id: "PS01",
    app_name: "Patient Intake Triage Assistant",
    gemini_configured: Boolean(process.env.GEMINI_API_KEY),
    oauth_configured: Boolean(process.env.OAUTH_CLIENT_ID),
  });
});

app.get("/api/rules", (req, res) => {
  if (triageRulesData) {
    res.json(triageRulesData);
  } else {
    res.status(500).json({ error: "Rules knowledge base not loaded." });
  }
});

// Full triage assessment endpoint
app.post("/api/triage/analyze", async (req, res) => {
  try {
    const { patient_description, follow_up_answers } = req.body;
    if (!patient_description || patient_description.trim().length < 2) {
      return res.status(400).json({ error: "Patient description is required." });
    }

    const facts = await extractFactsWithGemini(patient_description, follow_up_answers || {});
    const ruleResult = evaluateRules(facts);

    const result = {
      facts,
      recommendation: ruleResult,
      triage_note: {
        track_id: "PS01",
        urgency_level: ruleResult.urgency_level,
        urgency_name: ruleResult.urgency_name,
        department: ruleResult.department,
        rule_id: ruleResult.rule_id,
        citation_text: ruleResult.citation_text,
        escalate_to_human: ruleResult.escalate_to_human,
        reasoning: ruleResult.reasoning,
        what_patient_reported: facts.what_patient_reported || [patient_description],
        what_followups_established: facts.what_followups_established || [],
        what_remains_unknown: facts.what_remains_unknown || [],
        disclaimer: "This triage assistant strictly does NOT provide medical diagnosis. Every recommendation cites a published protocol rule. High-risk or uncertain cases must be handed off immediately to a human bedside clinician."
      }
    };

    res.json(result);
  } catch (err: any) {
    console.error("Triage analyze error:", err);
    res.status(500).json({ error: err.message || "Failed to process triage analysis" });
  }
});

// ----------------------------------------------------
// AUTHENTICATION & REGISTRATION ROUTES
// ----------------------------------------------------

app.get("/api/auth/demo-users", (req, res) => {
  const users = readJsonFile<AppUser[]>(USERS_FILE, DEFAULT_DEMO_USERS);
  res.json({ users });
});

// Create account for patient or staff
app.post("/api/auth/register", (req, res) => {
  try {
    const {
      accountType,
      name,
      email,
      password,
      phone,
      age,
      gender,
      medicalConditions,
      allergies,
      role,
      specialty,
      station,
      licenseNumber
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Full name is required." });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ error: "Email address is required." });
    }

    const cleanEmail = email.trim().toLowerCase();
    const users = readJsonFile<AppUser[]>(USERS_FILE, DEFAULT_DEMO_USERS);

    const existing = users.find(u => u.email.toLowerCase() === cleanEmail);
    if (existing) {
      return res.status(400).json({ error: "An account with this email already exists. Please log in." });
    }

    const isStaff = accountType === "staff";
    let userAvatar = isStaff
      ? (gender === "Female"
          ? "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&auto=format&fit=crop&q=80"
          : "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150&auto=format&fit=crop&q=80")
      : (gender === "Female"
          ? "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80"
          : "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80");

    const newUser: AppUser = {
      id: `${isStaff ? "staff" : "patient"}_${Date.now()}`,
      name: name.trim(),
      email: cleanEmail,
      role: isStaff ? (role || "Clinical Staff") : "Patient",
      station: isStaff ? (station || "General Intake Desk") : "Outpatient / Walk-in",
      avatar: userAvatar,
      accountType: isStaff ? "staff" : "patient",
      password: password || "HospitalSafe2026!",
      phone: phone || "",
      age: age ? Number(age) || age : undefined,
      gender: gender || "Unspecified",
      medicalConditions: medicalConditions || "",
      allergies: allergies || "",
      specialty: isStaff ? (specialty || "Emergency & General Care") : undefined,
      licenseNumber: isStaff ? (licenseNumber || `LIC-${Math.floor(10000 + Math.random() * 90000)}`) : undefined,
    };

    users.push(newUser);
    writeJsonFile(USERS_FILE, users);

    const token = `token_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    SESSIONS.set(token, {
      token,
      user: newUser,
      expiresAt: Date.now() + 86400000
    });

    res.json({ token, user: newUser });
  } catch (err: any) {
    console.error("Registration error:", err);
    res.status(500).json({ error: "Failed to create account. Please try again." });
  }
});

app.post("/api/auth/login-demo", (req, res) => {
  const { user_id } = req.body;
  const users = readJsonFile<AppUser[]>(USERS_FILE, DEFAULT_DEMO_USERS);
  const user = users.find(u => u.id === user_id) || users[0];
  const token = `token_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  SESSIONS.set(token, {
    token,
    user,
    expiresAt: Date.now() + 86400000 // 24 hours
  });

  res.json({ token, user });
});

app.post("/api/auth/login-credentials", (req, res) => {
  const { email, password } = req.body;
  const cleanEmail = (email || "").toLowerCase().trim();
  const users = readJsonFile<AppUser[]>(USERS_FILE, DEFAULT_DEMO_USERS);
  const matchedUser = users.find(u => u.email.toLowerCase() === cleanEmail);

  let user: AppUser;
  if (matchedUser) {
    user = matchedUser;
  } else {
    // If not found, create seamless session for convenience
    const isDoctorLike = cleanEmail.includes("dr") || cleanEmail.includes("doctor") || cleanEmail.includes("hospital");
    const rawName = (email || "Patient User").split("@")[0].replace(/[._-]/g, " ");
    const formattedName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
    user = {
      id: `user_${Date.now()}`,
      name: isDoctorLike ? (formattedName.startsWith("Dr") ? formattedName : `Dr. ${formattedName}`) : formattedName,
      email: cleanEmail || "patient@care.org",
      role: isDoctorLike ? "Clinical Intake Officer" : "Patient",
      station: isDoctorLike ? "Emergency Desk 01" : "Outpatient Clinic",
      avatar: isDoctorLike
        ? "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150&auto=format&fit=crop&q=80"
        : "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80",
      accountType: isDoctorLike ? "staff" : "patient"
    };
    users.push(user);
    writeJsonFile(USERS_FILE, users);
  }

  const token = `token_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  SESSIONS.set(token, {
    token,
    user,
    expiresAt: Date.now() + 86400000 // 24 hours
  });

  res.json({ token, user });
});

app.get("/api/auth/session", (req, res) => {
  const authHeader = req.headers.authorization;
  let token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
  if (!token && req.query.token) {
    token = String(req.query.token);
  }

  if (token && SESSIONS.has(token)) {
    const sess = SESSIONS.get(token)!;
    if (Date.now() < sess.expiresAt) {
      return res.json({ authenticated: true, user: sess.user, token });
    } else {
      SESSIONS.delete(token);
    }
  }

  res.json({ authenticated: false, user: null });
});

app.post("/api/auth/logout", (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    SESSIONS.delete(token);
  }
  res.json({ success: true });
});

// Robust JSON cleaner and parser
function cleanAndParseJson<T>(rawText: string, fallback: T): T {
  if (!rawText) return fallback;
  try {
    return JSON.parse(rawText);
  } catch (e) {
    const cleaned = rawText
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();
    try {
      return JSON.parse(cleaned);
    } catch (e2) {
      const firstBrace = cleaned.indexOf("{");
      const lastBrace = cleaned.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        try {
          return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
        } catch (e3) {
          // fallback
        }
      }
    }
  }
  return fallback;
}

// Meaningful clinical companion fallback generator
function generateMeaningfulCompanionResponse(
  message: string,
  patientInfo: any = {},
  checkedSymptomNames: string[] = []
) {
  const lower = (message || "").toLowerCase();
  const name = patientInfo.name ? patientInfo.name.split(" ")[0] : "there";

  // 1. Chest pain / cardiac concerns
  if (lower.includes("chest") || lower.includes("heart") || lower.includes("pressure") || lower.includes("crush") || lower.includes("angina") || lower.includes("palpitat")) {
    return {
      reply: `Dear ${name}, chest discomfort must always be treated with immediate priority and care. If the pressure feels crushing, squeezes into your left arm, neck, or jaw, or is accompanied by sudden cold sweating or breathlessness, please seek emergency evaluation right away. If you're resting right now, sit upright comfortably, loosen any tight clothing around your collar and waist, and take slow, calm breaths.`,
      comfortTips: [
        "Sit upright in a supportive chair to ease breathing and heart workload.",
        "Loosen tight collars, ties, or belts to relieve chest restriction.",
        "Seek emergency room evaluation or alert bedside staff immediately if pain radiates or cold sweats appear."
      ],
      actionRecommendation: "emergency",
      suggestions: [
        "Pain spreads to my arm or jaw",
        "No radiation, feels muscular or sharp",
        "Having cold sweats and shortness of breath",
        "Started after physical exertion"
      ],
      detectedSymptoms: ["Chest discomfort / tightness", "Cardiac evaluation recommended"]
    };
  }

  // 2. Breathing difficulty / shortness of breath
  if (lower.includes("breath") || lower.includes("short") || lower.includes("gasp") || lower.includes("wheez") || lower.includes("inhal") || lower.includes("chok")) {
    return {
      reply: `I understand how frightening it feels when catching your breath is difficult, ${name}. Take a gentle, slow breath with me. Sit upright with your shoulders dropped, and try breathing in slowly through your nose and gently out through pursed lips. If you have a prescribed rescue inhaler, keep it right by your side. If you find it hard to speak in complete sentences or your lips look bluish, let's have our emergency team examine you immediately.`,
      comfortTips: [
        "Sit upright with your chest slightly tilted forward to maximize airway capacity.",
        "Practice pursed-lip breathing: slow inhale through nose, double-length exhale through lips.",
        "If you use a prescribed inhaler or nebulizer, use as directed by your physician."
      ],
      actionRecommendation: "triage",
      suggestions: [
        "I can speak full sentences comfortably",
        "Struggling to finish a complete sentence",
        "I have asthma and have my inhaler",
        "Breathing worsens when lying flat"
      ],
      detectedSymptoms: ["Difficulty catching breath", "Respiratory distress"]
    };
  }

  // 3. Fever / Chills / High Temperature
  if (lower.includes("fever") || lower.includes("temp") || lower.includes("hot") || lower.includes("chill") || lower.includes("shiver") || lower.includes("burn")) {
    return {
      reply: `Fevers can leave you feeling drained, achy, and exhausted, ${name}. A fever is your body's immune system working hard to fight off an infection. Stay in a temperate, well-ventilated room wearing light, breathable clothing, and drink plenty of fluids like water, oral rehydration solution, or warm herbal broth. Watch closely for critical warning signs like a stiff neck, sensitivity to bright lights, or confusion, which need immediate physician evaluation.`,
      comfortTips: [
        "Drink small, frequent sips of water, electrolyte fluids, or clear broth to stay well-hydrated.",
        "Rest in lightweight clothing; avoid heavy blankets which trap body heat.",
        "Apply a lukewarm (not ice cold) damp cloth across your forehead or back of your neck."
      ],
      actionRecommendation: "booking",
      suggestions: [
        "Fever is above 102°F (38.9°C)",
        "Fever started 1-2 days ago",
        "No neck stiffness or rash present",
        "Trouble keeping liquids down"
      ],
      detectedSymptoms: ["High fever / chills", "Elevated body temperature"]
    };
  }

  // 4. Physical injury / Fall / Ankle / Sprain / Bleeding / Fracture / Cannot walk
  if (lower.includes("fall") || lower.includes("fell") || lower.includes("hurt") || lower.includes("bone") || lower.includes("ankle") || lower.includes("knee") || lower.includes("leg") || lower.includes("foot") || lower.includes("twist") || lower.includes("sprain") || lower.includes("cut") || lower.includes("bleed") || lower.includes("wound")) {
    return {
      reply: `Ouch, ${name}, that sounds really painful! Acute injuries need careful handling to protect the joint and soft tissues. Follow the gentle R.I.C.E. protocol right now: Rest the injured area, apply an Ice pack wrapped in a cloth for 15-20 minutes, keep light Compression if swollen, and Elevate the limb above heart level. If you are unable to take four weight-bearing steps or notice visible deformity, an X-ray evaluation by a doctor is strongly recommended.`,
      comfortTips: [
        "Rest and keep weight completely off the injured joint or limb.",
        "Elevate the area on soft pillows above the level of your heart to drain fluid.",
        "Apply an ice pack wrapped in a towel for 15 minutes at a time (never apply ice directly to bare skin)."
      ],
      actionRecommendation: "booking",
      suggestions: [
        "Cannot bear weight or take 4 steps",
        "Can walk with mild to moderate limp",
        "Significant swelling and bruising visible",
        "No open cut, but tender to touch"
      ],
      detectedSymptoms: ["Physical injury / limb trauma", "Cannot bear full weight"]
    };
  }

  // 5. Abdominal pain / Stomach / Vomiting / Nausea / Diarrhea
  if (lower.includes("stomach") || lower.includes("belly") || lower.includes("cramp") || lower.includes("abdom") || lower.includes("vomit") || lower.includes("nausea") || lower.includes("throw up") || lower.includes("diarrhea")) {
    return {
      reply: `Stomach pain and nausea can be so draining and uncomfortable, ${name}. While your digestive tract is sensitive, give your stomach a rest by pausing heavy foods and sipping clear fluids or electrolyte drinks very slowly. If the pain is sharp and localized in your lower right abdomen, if your belly feels rigid or hard like a board, or if you cannot keep liquids down for more than 12 hours, please see our triage staff without delay.`,
      comfortTips: [
        "Take small sips of room-temperature water or electrolyte solutions every few minutes.",
        "Rest on your side with knees slightly drawn up to relieve abdominal wall tension.",
        "Avoid greasy, acidic, or dairy foods until your stomach settles."
      ],
      actionRecommendation: "triage",
      suggestions: [
        "Sharp pain localized in lower right belly",
        "Dull cramping all over abdomen",
        "Experiencing vomiting and nausea",
        "Belly is soft, not rigid to touch"
      ],
      detectedSymptoms: ["Abdominal cramps / nausea", "Gastrointestinal distress"]
    };
  }

  // 6. Headache / Migraine / Dizziness
  if (lower.includes("headache") || lower.includes("migraine") || lower.includes("head") || lower.includes("dizzy") || lower.includes("lighthead") || lower.includes("vertigo")) {
    return {
      reply: `Headaches and dizziness can be truly debilitating, ${name}. Resting in a quiet, darkened room away from phone or computer screens can help soothe nerve irritation. Drink a tall glass of cool water, as mild dehydration is one of the most common headache triggers. However, if this feels like a sudden 'thunderclap' (the worst headache of your life), or if you notice weakness on one side of your face or body, please alert clinical staff immediately.`,
      comfortTips: [
        "Rest in a quiet, dark room and dim all screens and artificial lighting.",
        "Hydrate with a glass of water or electrolyte solution.",
        "Apply a cool damp cloth across your forehead or a warm pad on tight neck muscles."
      ],
      actionRecommendation: "booking",
      suggestions: [
        "Throbbing pain on one side of head",
        "Sensitive to light and sound",
        "Dizzy when standing up quickly",
        "Steady tension across forehead and temples"
      ],
      detectedSymptoms: ["Headache / migraine", "Dizziness / lightheadedness"]
    };
  }

  // 7. Medications / "Can I take medicine?"
  if (lower.includes("med") || lower.includes("pill") || lower.includes("tylenol") || lower.includes("advil") || lower.includes("ibuprofen") || lower.includes("aspirin") || lower.includes("paracetamol") || lower.includes("dose")) {
    return {
      reply: `Asking about medications is very wise, ${name}. While common over-the-counter pain relievers like acetaminophen (paracetamol) or ibuprofen are often used for fever and pain, safety depends on your personal health history—such as liver, kidney, or stomach conditions, and other prescriptions you take. When you speak with our attending physician today, they will verify your records and specify the safest medicine and exact dose for you.`,
      comfortTips: [
        "Never take medications on an empty stomach unless directed by a physician.",
        "Keep a photo or list of your current prescriptions and allergies handy for your consultation.",
        "Avoid mixing multiple cold or flu remedies that may contain duplicate active ingredients."
      ],
      actionRecommendation: "booking",
      suggestions: [
        "I have existing medication allergies",
        "Currently taking daily prescription drugs",
        "Looking for non-medication comfort tips",
        "Want to consult the doctor on safe dosage"
      ],
      detectedSymptoms: ["Medication consultation requested"]
    };
  }

  // 8. General empathetic checkup / Default
  return {
    reply: `Thank you for sharing that with me, ${name}. I am right here beside you to guide you through your intake. Every symptom you mention helps our clinical team prepare the right room, triage priority, and doctor for your visit. Tell me what you're feeling, or click below to generate your official triage note or schedule a slot with an on-duty physician.`,
    comfortTips: [
      "Take slow, gentle breaths and rest in a relaxed position.",
      "Check off any relevant symptoms on your intake checklist so doctors have full context.",
      "Click 'Generate Triage Note' or 'Book Doctor Slot' whenever you feel ready."
    ],
    actionRecommendation: "triage",
    suggestions: [
      "Started earlier today",
      "Pain is moderate (around 4 out of 10)",
      "Feeling anxious about my symptoms",
      "Ready to book a doctor consultation"
    ],
    detectedSymptoms: [message.slice(0, 30).trim()]
  };
}

// ----------------------------------------------------
// FRIENDLY COMPANION CHAT ROUTE ("LIKE A FRIEND")
// ----------------------------------------------------

app.post("/api/chat/friendly-message", async (req, res) => {
  const { message, conversationHistory = [], checklist = [], patientInfo = {} } = req.body;
  const checkedSymptomNames = (checklist || []).filter((c: any) => c.checked).map((c: any) => c.label);

  try {
    const ai = getGeminiClient();
    if (!ai) {
      const fallbackResult = generateMeaningfulCompanionResponse(message, patientInfo, checkedSymptomNames);
      return res.json(fallbackResult);
    }

    const systemPrompt = `You are CarePal, an extraordinarily compassionate, knowledgeable, and attentive healthcare companion.
You talk to the patient like an empathetic, highly supportive medical friend and triage guide.
Your goal is to provide MEANINGFUL, reassuring, and informative answers to help the patient understand their situation, feel calm, and know the best next steps.

Guidelines for meaningful patient communication:
1. Empathy & Validation: Acknowledge their symptoms or questions with genuine care and warm human empathy (e.g., "I know how distressing that feels, [Name]," "You are in good hands, and we are going to get this addressed").
2. Meaningful Medical Context (Educational, not diagnostic):
   - Answer their specific questions directly and clearly.
   - Explain what typically causes these symptoms in plain, easy-to-understand terms without giving a definitive medical diagnosis (e.g. "Sharp pain when bearing weight often points to an acute ankle ligament strain or bone contusion," "A fever is the body's natural immunological response to clear out bacteria or viruses").
   - Offer 2-3 practical, safe, immediate comfort measures (e.g. rest, elevation, cool cloth, staying hydrated, avoiding strain).
3. Red Flag Safety Awareness:
   - If they describe severe symptoms (e.g. crushing chest pain, severe shortness of breath, loss of consciousness, inability to stand, stiff neck with fever, uncontrolled bleeding), clearly and calmly urge immediate urgent clinical evaluation.
4. Next Steps in Care:
   - Guide them toward generating their structured clinical triage note or booking a consultation with our on-duty specialists right from the app.
5. Quick Reply Suggestions:
   - Provide 3-4 natural, conversational follow-up chips the patient can easily tap.
6. Detected Symptoms:
   - List any specific symptoms mentioned so they can be tracked on their clinical intake checklist.

Patient Context:
- Name: ${patientInfo.name || "Friend"}
- Age: ${patientInfo.age || "Not specified"}
- Medical conditions: ${patientInfo.medicalConditions || "None recorded"}
- Current checklist items: ${checkedSymptomNames.join(", ") || "None selected yet"}

Respond strictly in valid JSON format:
{
  "reply": "Warm, detailed, meaningful answer explaining their situation and offering reassuring guidance.",
  "comfortTips": ["Tip 1", "Tip 2", "Tip 3"],
  "actionRecommendation": "triage" | "booking" | "emergency" | "comfort",
  "suggestions": ["Follow-up chip 1", "Follow-up chip 2", "Follow-up chip 3"],
  "detectedSymptoms": ["Symptom 1", "Symptom 2"]
}`;

    const recentHistory = (conversationHistory || []).slice(-6).map((m: any) => `${m.sender === "user" ? "Patient" : "CarePal"}: ${m.text}`).join("\n");
    const userPrompt = `Recent Conversation:\n${recentHistory}\n\nPatient just said: "${message}"\n\nGenerate your warm, meaningful companion response in JSON.`;

    const result = await generateContentWithFallback(ai, {
      contents: [
        { role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    const fallbackResult = generateMeaningfulCompanionResponse(message, patientInfo, checkedSymptomNames);

    const parsed = cleanAndParseJson(result.response.text, null);

    if (parsed && parsed.reply) {
      return res.json({
        reply: parsed.reply,
        comfortTips: Array.isArray(parsed.comfortTips) && parsed.comfortTips.length > 0 
          ? parsed.comfortTips 
          : fallbackResult.comfortTips,
        actionRecommendation: parsed.actionRecommendation || fallbackResult.actionRecommendation || "triage",
        suggestions: Array.isArray(parsed.suggestions) && parsed.suggestions.length > 0 
          ? parsed.suggestions 
          : fallbackResult.suggestions,
        detectedSymptoms: Array.isArray(parsed.detectedSymptoms) && parsed.detectedSymptoms.length > 0 
          ? parsed.detectedSymptoms 
          : fallbackResult.detectedSymptoms
      });
    }

    // If parsed JSON had unexpected shape, use meaningful fallback
    return res.json(fallbackResult);
  } catch (err: any) {
    console.warn("Friendly companion chat using rich clinical fallback:", err?.message || err);
    const fallbackResult = generateMeaningfulCompanionResponse(message, patientInfo, checkedSymptomNames);
    return res.json(fallbackResult);
  }
});

// ----------------------------------------------------
// INTAKE DATA PERSISTENCE ROUTES
// ----------------------------------------------------

app.post("/api/intake/save", (req, res) => {
  try {
    const {
      patientId,
      patientName,
      patientEmail,
      patientDescription,
      checklistItems,
      facts,
      triageNote
    } = req.body;

    const intakes = readJsonFile<any[]>(INTAKES_FILE, []);
    const newRecord = {
      id: `intake_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      patientId: patientId || "anonymous_patient",
      patientName: patientName || "Walk-in Patient",
      patientEmail: patientEmail || "",
      timestamp: new Date().toISOString(),
      patientDescription: patientDescription || "",
      checklistItems: checklistItems || [],
      facts: facts || {},
      triageNote: triageNote || {}
    };

    intakes.unshift(newRecord);
    writeJsonFile(INTAKES_FILE, intakes);

    res.json({ success: true, record: newRecord });
  } catch (err: any) {
    console.error("Save intake error:", err);
    res.status(500).json({ error: "Failed to persist intake record." });
  }
});

app.get("/api/intake/records", (req, res) => {
  try {
    const { patientId, patientEmail } = req.query;
    const intakes = readJsonFile<any[]>(INTAKES_FILE, []);

    if (patientId) {
      const filtered = intakes.filter(i => i.patientId === patientId);
      return res.json({ records: filtered });
    }
    if (patientEmail) {
      const filtered = intakes.filter(i => (i.patientEmail || "").toLowerCase() === String(patientEmail).toLowerCase());
      return res.json({ records: filtered });
    }

    res.json({ records: intakes });
  } catch (err: any) {
    console.error("Get intake records error:", err);
    res.status(500).json({ error: "Failed to load intake records." });
  }
});

// ----------------------------------------------------
// DOCTORS & APPOINTMENT SLOT BOOKING ROUTES
// ----------------------------------------------------

app.get("/api/doctors", (req, res) => {
  const doctors = readJsonFile<any[]>(DOCTORS_FILE, DEFAULT_DOCTORS);
  res.json({ doctors });
});

app.get("/api/appointments", (req, res) => {
  try {
    const { patientId, doctorId } = req.query;
    const appointments = readJsonFile<any[]>(APPOINTMENTS_FILE, []);

    if (patientId) {
      const filtered = appointments.filter(a => a.patientId === patientId);
      return res.json({ appointments: filtered });
    }
    if (doctorId) {
      const filtered = appointments.filter(a => a.doctorId === doctorId);
      return res.json({ appointments: filtered });
    }

    res.json({ appointments });
  } catch (err: any) {
    console.error("Get appointments error:", err);
    res.status(500).json({ error: "Failed to load appointments." });
  }
});

app.post("/api/appointments/book", (req, res) => {
  try {
    const {
      patientId,
      patientName,
      patientEmail,
      patientPhone,
      doctorId,
      date,
      timeSlot,
      urgencyLevel,
      urgencyName,
      reason,
      checklistSummary
    } = req.body;

    if (!doctorId) {
      return res.status(400).json({ error: "Doctor selection is required." });
    }
    if (!timeSlot) {
      return res.status(400).json({ error: "Time slot is required." });
    }

    const doctors = readJsonFile<any[]>(DOCTORS_FILE, DEFAULT_DOCTORS);
    const doctor = doctors.find(d => d.id === doctorId) || doctors[0];

    const appointments = readJsonFile<any[]>(APPOINTMENTS_FILE, []);
    const newAppointment = {
      id: `apt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      patientId: patientId || "patient-guest",
      patientName: patientName || "Guest Patient",
      patientEmail: patientEmail || "",
      patientPhone: patientPhone || "",
      doctorId: doctor.id,
      doctorName: doctor.name,
      doctorSpecialty: doctor.specialty,
      doctorRoom: doctor.room,
      date: date || "Today",
      timeSlot: timeSlot,
      urgencyLevel: urgencyLevel || 3,
      urgencyName: urgencyName || "Urgent Clinical Evaluation",
      reason: reason || "Intake triage consultation",
      checklistSummary: checklistSummary || [],
      status: "Confirmed",
      createdAt: new Date().toISOString()
    };

    appointments.unshift(newAppointment);
    writeJsonFile(APPOINTMENTS_FILE, appointments);

    res.json({ success: true, appointment: newAppointment });
  } catch (err: any) {
    console.error("Book appointment error:", err);
    res.status(500).json({ error: "Failed to book appointment slot." });
  }
});

app.patch("/api/appointments/:id/status", (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const appointments = readJsonFile<any[]>(APPOINTMENTS_FILE, []);
    const appointment = appointments.find(a => a.id === id);

    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found." });
    }

    appointment.status = status;
    writeJsonFile(APPOINTMENTS_FILE, appointments);

    res.json({ success: true, appointment });
  } catch (err: any) {
    console.error("Update appointment status error:", err);
    res.status(500).json({ error: "Failed to update appointment status." });
  }
});

app.delete("/api/appointments/:id", (req, res) => {
  try {
    const { id } = req.params;
    let appointments = readJsonFile<any[]>(APPOINTMENTS_FILE, []);
    const initialLen = appointments.length;
    appointments = appointments.filter(a => a.id !== id);

    if (appointments.length === initialLen) {
      return res.status(404).json({ error: "Appointment not found." });
    }

    writeJsonFile(APPOINTMENTS_FILE, appointments);
    res.json({ success: true, message: "Appointment cancelled successfully." });
  } catch (err: any) {
    console.error("Cancel appointment error:", err);
    res.status(500).json({ error: "Failed to cancel appointment." });
  }
});

// OAuth URL generator following the oauth-integration skill
app.get("/api/auth/url", (req, res) => {
  const appUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
  const redirectUri = `${appUrl}/auth/callback`;
  const clientId = process.env.OAUTH_CLIENT_ID;

  if (!clientId) {
    // Return interactive hospital staff OAuth simulated provider
    return res.json({
      url: `${appUrl}/auth/mock-oauth-login?redirect_uri=${encodeURIComponent(redirectUri)}`,
      configured: false,
      message: "OAUTH_CLIENT_ID not configured in secrets. Using integrated Hospital SSO provider."
    });
  }

  // Google OAuth 2.0 Authorization Endpoint
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "token",
    scope: "openid email profile",
    prompt: "consent"
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  res.json({ url: authUrl, configured: true });
});

// Interactive Hospital Staff OAuth SSO portal for preview/testing
app.get("/auth/mock-oauth-login", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Hospital Staff OAuth 2.0 Portal</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0b1329; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
        .card { background: #132247; border: 1px solid #1e3a8a; border-radius: 16px; padding: 32px; max-width: 460px; width: 100%; box-shadow: 0 20px 40px rgba(0,0,0,0.6); }
        .badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 9999px; background: rgba(56, 189, 248, 0.15); color: #38bdf8; font-size: 0.75rem; font-weight: 600; margin-bottom: 12px; }
        h2 { margin: 0 0 8px 0; font-size: 1.4rem; color: #f8fafc; }
        p { color: #94a3b8; font-size: 0.88rem; line-height: 1.5; margin-bottom: 24px; }
        .user-btn { width: 100%; display: flex; align-items: center; gap: 14px; padding: 14px; margin-bottom: 12px; background: #0f172a; border: 1px solid #334155; border-radius: 12px; color: white; cursor: pointer; text-align: left; transition: all 0.2s; }
        .user-btn:hover { border-color: #38bdf8; background: #1e293b; transform: translateY(-1px); }
        .avatar { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; border: 2px solid #38bdf8; }
        .name { font-weight: 600; font-size: 0.95rem; }
        .role { font-size: 0.8rem; color: #38bdf8; }
        .station { font-size: 0.75rem; color: #64748b; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="badge">Healthcare OAuth 2.0 Provider</div>
        <h2>Clinical Staff SSO Verification</h2>
        <p>Select your authorized clinical staff profile to grant intake triage permissions:</p>
        
        <button class="user-btn" onclick="authorize('Nurse Sarah Chen, BSN, RN', 'sarah.chen@hospital.org', 'Triage Staff Nurse', 'Intake Desk 01', 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&auto=format&fit=crop&q=80')">
          <img class="avatar" src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&auto=format&fit=crop&q=80">
          <div>
            <div class="name">Nurse Sarah Chen, BSN, RN</div>
            <div class="role">Triage Staff Nurse</div>
            <div class="station">Station: Intake Desk 01</div>
          </div>
        </button>

        <button class="user-btn" onclick="authorize('Dr. Marcus Vance, MD', 'marcus.vance@hospital.org', 'Emergency Attending', 'Resuscitation Bay Lead', 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150&auto=format&fit=crop&q=80')">
          <img class="avatar" src="https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150&auto=format&fit=crop&q=80">
          <div>
            <div class="name">Dr. Marcus Vance, MD</div>
            <div class="role">Emergency Attending</div>
            <div class="station">Station: Resuscitation Bay Lead</div>
          </div>
        </button>

        <button class="user-btn" onclick="authorize('Alex Rivera', 'alex.rivera@hospital.org', 'Patient Access Specialist', 'Registration', 'https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=150&auto=format&fit=crop&q=80')">
          <img class="avatar" src="https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=150&auto=format&fit=crop&q=80">
          <div>
            <div class="name">Alex Rivera</div>
            <div class="role">Patient Access Specialist</div>
            <div class="station">Station: Registration & Ambulatory Triage</div>
          </div>
        </button>
      </div>

      <script>
        function authorize(name, email, role, station, avatar) {
          const user = {
            id: 'oauth-' + Date.now(),
            name,
            email,
            role,
            station,
            avatar
          };
          if (window.opener) {
            window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', user }, '*');
            window.close();
          } else {
            alert('Authentication complete. Please return to the main window.');
          }
        }
      </script>
    </body>
    </html>
  `);
});

// OAuth Callback handling with postMessage as mandated by oauth-integration skill
const oauthCallbackHandler = (req: express.Request, res: express.Response) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Authentication Successful</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #0f172a; color: #f8fafc; text-align: center; padding-top: 50px; }
        </style>
      </head>
      <body>
        <script>
          if (window.opener) {
            // Check hash fragment or query params
            const hash = window.location.hash.substring(1);
            const params = new URLSearchParams(hash || window.location.search);
            const token = params.get('access_token') || params.get('code');

            window.opener.postMessage({ 
              type: 'OAUTH_AUTH_SUCCESS',
              token: token
            }, '*');
            window.close();
          } else {
            window.location.href = '/';
          }
        </script>
        <h3>Authentication verified successfully!</h3>
        <p>This popup window will close automatically...</p>
      </body>
    </html>
  `);
};

app.get(["/auth/callback", "/auth/callback/"], oauthCallbackHandler);

// ----------------------------------------------------
// VITE OR STATIC SERVING
// ----------------------------------------------------

async function start() {
  try {
    if (process.env.NODE_ENV !== "production") {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        const indexPath = path.join(distPath, "index.html");
        if (fs.existsSync(indexPath)) {
          res.sendFile(indexPath);
        } else {
          res.status(200).send("<!DOCTYPE html><html><body><h1>CarePal Triage</h1><p>Loading application...</p></body></html>");
        }
      });
    }

    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`Healthcare Intake Triage Server running on http://0.0.0.0:${PORT} (ENV: ${process.env.NODE_ENV || "development"})`);
    });

    server.on("error", (err) => {
      console.error("Server listener error:", err);
    });
  } catch (err) {
    console.error("Fatal startup error in start():", err);
    process.exit(1);
  }
}

start();
