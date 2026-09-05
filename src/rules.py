import json
import os
from typing import Any, Dict, List, Optional, Tuple

RULES_FILE_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "triage_rules.json")

def load_triage_rules() -> Dict[str, Any]:
    with open(RULES_FILE_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def evaluate_deterministic_rules(facts: Dict[str, Any]) -> Dict[str, Any]:
    """
    Pure deterministic rule matching engine.
    Separates LLM fact extraction from clinical urgency determination.
    Does NOT diagnose diseases.
    """
    complaint_family = facts.get("complaint_family", "general_escalation")
    symptoms = [s.lower() for s in facts.get("symptoms", [])]
    flags = facts.get("red_flags", {})
    age_years = facts.get("age_years")
    age_months = facts.get("age_months")
    duration_days = facts.get("duration_days", 0)

    # 1. CHEST PAIN EVALUATION
    if complaint_family == "chest_pain":
        has_sweating = flags.get("diaphoresis") is True or any("sweat" in s for s in symptoms)
        has_radiation = flags.get("radiation_arm_jaw") is True or any("radiat" in s or "arm" in s or "jaw" in s for s in symptoms)
        has_dyspnea = flags.get("shortness_of_breath") is True or any("breath" in s or "short" in s for s in symptoms)
        is_crushing = flags.get("crushing_pressure") is True or any("crush" in s or "heavy" in s or "tight" in s or "elephant" in s for s in symptoms)

        if has_sweating or has_radiation or (is_crushing and has_dyspnea):
            return {
                "rule_id": "R-CHEST-01",
                "urgency_level": 1,
                "urgency_name": "Immediate (Resuscitation)",
                "department": "Emergency Resuscitation Bay",
                "escalate_to_human": true,
                "citation_text": "Protocol R-CHEST-01: Chest pain or pressure accompanied by autonomic symptoms (diaphoresis), pain radiation to arm/jaw, or respiratory distress carries high suspicion of Acute Coronary Syndrome (ACS). Mandatory immediate Resuscitation Bay routing and immediate human clinical assessment.",
                "reasoning": "High-risk cardiac red flags present (sweating/radiation/pressure)."
            }
        
        has_pleuritic = flags.get("pleuritic_worsening") is True or any("breath" in s and "worse" in s or "sharp" in s for s in symptoms)
        if has_pleuritic:
            return {
                "rule_id": "R-CHEST-02",
                "urgency_level": 2,
                "urgency_name": "Emergent",
                "department": "Emergency Department - Acute Assessment",
                "escalate_to_human": true,
                "citation_text": "Protocol R-CHEST-02: Acute sharp pleuritic chest discomfort warrants urgent rule-out for pulmonary thromboembolism, pneumothorax, or pericarditis.",
                "reasoning": "Sharp pleuritic pain requiring immediate 12-lead ECG and ED provider evaluation."
            }

        is_reproducible = flags.get("reproducible_on_palpation") is True or any("press" in s or "touch" in s or "muscl" in s for s in symptoms)
        if is_reproducible and not has_dyspnea and not has_sweating:
            return {
                "rule_id": "R-CHEST-03",
                "urgency_level": 4,
                "urgency_name": "Less Urgent",
                "department": "Urgent Care Clinic",
                "escalate_to_human": false,
                "citation_text": "Protocol R-CHEST-03: Localized chest wall tenderness strictly reproducible by palpation with negative cardiovascular screens (no radiation, no diaphoresis, no dyspnea).",
                "reasoning": "Reproducible chest wall tenderness with negative red-flag screen."
            }

    # 2. BREATHING DIFFICULTY EVALUATION
    elif complaint_family == "breathing_difficulty":
        severe_airway = (
            flags.get("cyanosis") is True or 
            flags.get("stridor") is True or 
            flags.get("unable_to_speak_sentences") is True or
            any("blue" in s or "chok" in s or "gasp" in s or "can't speak" in s for s in symptoms)
        )
        if severe_airway:
            return {
                "rule_id": "R-BREATH-01",
                "urgency_level": 1,
                "urgency_name": "Immediate (Resuscitation)",
                "department": "Emergency Resuscitation Bay",
                "escalate_to_human": true,
                "citation_text": "Protocol R-BREATH-01: Inability to speak in full sentences, cyanosis, audible stridor, or severe work of breathing indicates impending respiratory failure. Immediate resuscitation allocation.",
                "reasoning": "Critical airway or ventilatory compromise detected."
            }

        has_wheeze_or_asthma = flags.get("asthma_or_copd") is True or any("asthma" in s or "wheez" in s or "inhaler" in s for s in symptoms)
        if has_wheeze_or_asthma:
            return {
                "rule_id": "R-BREATH-02",
                "urgency_level": 2,
                "urgency_name": "Emergent",
                "department": "Emergency Department - Acute Assessment",
                "escalate_to_human": true,
                "citation_text": "Protocol R-BREATH-02: Acute bronchospasm or dyspnea with underlying pulmonary history warrants emergent ED assessment and nebulized therapy.",
                "reasoning": "Bronchospasm or acute exacerbation requiring acute provider workup."
            }

        return {
            "rule_id": "R-BREATH-03",
            "urgency_level": 4,
            "urgency_name": "Less Urgent",
            "department": "Emergency Department - Fast Track",
            "escalate_to_human": false,
            "citation_text": "Protocol R-BREATH-03: Mild upper respiratory symptoms with normal conversational capability, no resting tachypnea, and no accessory muscle utilization.",
            "reasoning": "Mild respiratory presentation without distress."
        }

    # 3. FEVER EVALUATION
    elif complaint_family == "fever":
        is_neonate = (age_months is not None and age_months < 3) or (age_years is not None and age_years == 0)
        has_meningeal = flags.get("stiff_neck") is True or flags.get("petechial_rash") is True or any("stiff neck" in s or "purple spots" in s or "rash" in s for s in symptoms)

        if is_neonate or has_meningeal:
            return {
                "rule_id": "R-FEVER-01",
                "urgency_level": 2,
                "urgency_name": "Emergent",
                "department": "Pediatric Emergency" if is_neonate else "Emergency Department - Acute Assessment",
                "escalate_to_human": true,
                "citation_text": "Protocol R-FEVER-01: Fever in neonates (<90 days) or fever combined with meningeal signs (stiff neck, photophobia) or non-blanching rash requires immediate emergent routing for sepsis/meningitis workup.",
                "reasoning": "High-risk fever red flag (pediatric age < 3 months or meningeal/septic signs)."
            }

        has_dehydration = flags.get("dehydration_or_vomiting") is True or duration_days >= 3 or any("vomit" in s or "dehydrat" in s or "can't drink" in s for s in symptoms)
        if has_dehydration:
            return {
                "rule_id": "R-FEVER-02",
                "urgency_level": 3,
                "urgency_name": "Urgent",
                "department": "Emergency Department - Acute Assessment",
                "escalate_to_human": false,
                "citation_text": "Protocol R-FEVER-02: Prolonged fever with signs of systemic dehydration or inability to maintain oral hydration warrants Urgent care for fluid rehydration and lab investigation.",
                "reasoning": "Prolonged fever or oral intolerance requiring assessment."
            }

        return {
            "rule_id": "R-FEVER-03",
            "urgency_level": 4,
            "urgency_name": "Less Urgent",
            "department": "Walk-In Ambulatory Clinic",
            "escalate_to_human": false,
            "citation_text": "Protocol R-FEVER-03: Mild-to-moderate fever of short duration (<3 days) in an alert, well-hydrated patient with no high-risk comorbidities or focal signs routes to Walk-In Ambulatory Clinic.",
            "reasoning": "Uncomplicated acute viral presentation without red flags."
        }

    # 4. INJURY / TRAUMA EVALUATION
    elif complaint_family == "injury":
        is_major_trauma = (
            flags.get("high_energy_trauma") is True or 
            flags.get("active_bleeding") is True or 
            flags.get("loss_of_consciousness") is True or
            any("crash" in s or "bleeding heavily" in s or "blacked out" in s or "passed out" in s or "bone sticking" in s for s in symptoms)
        )
        if is_major_trauma:
            return {
                "rule_id": "R-INJURY-01",
                "urgency_level": 1,
                "urgency_name": "Immediate (Resuscitation)",
                "department": "Emergency Resuscitation Bay",
                "escalate_to_human": true,
                "citation_text": "Protocol R-INJURY-01: High-energy kinetic mechanism, penetrative trauma, pulseless injured extremity, or uncontrolled bleeding triggers Level 1 Resuscitation and immediate trauma team activation.",
                "reasoning": "Severe kinetic trauma mechanism, active hemorrhage, or altered consciousness."
            }

        cannot_bear_weight = flags.get("cannot_bear_weight") is True or any("cannot walk" in s or "can't walk" in s or "can't bear weight" in s or "fracture" in s or "swollen" in s for s in symptoms)
        if cannot_bear_weight:
            return {
                "rule_id": "R-INJURY-02",
                "urgency_level": 3,
                "urgency_name": "Urgent",
                "department": "Urgent Care Orthopedics / Fast Track",
                "escalate_to_human": false,
                "citation_text": "Protocol R-INJURY-02: Isolated extremity trauma with positive weight-bearing deficit or bony focal tenderness (Ottawa rules positive) requires radiographic imaging and orthopedic evaluation.",
                "reasoning": "Ottawa positive weight-bearing deficit or suspected closed fracture."
            }

        return {
            "rule_id": "R-INJURY-03",
            "urgency_level": 5,
            "urgency_name": "Non-Urgent",
            "department": "Walk-In Ambulatory Clinic",
            "escalate_to_human": false,
            "citation_text": "Protocol R-INJURY-03: Low-velocity superficial soft tissue trauma with full mobility and preserved neurovascular integrity routes to Walk-In Ambulatory Clinic.",
            "reasoning": "Superficial contusion/sprain with intact weight bearing and mobility."
        }

    # 5. ABDOMINAL PAIN EVALUATION
    elif complaint_family == "abdominal_pain":
        has_peritoneal_or_shock = (
            flags.get("rigid_abdomen") is True or 
            flags.get("syncope") is True or 
            flags.get("vomiting_blood") is True or
            any("rigid" in s or "fainted" in s or "passed out" in s or "blood" in s for s in symptoms)
        )
        if has_peritoneal_or_shock:
            return {
                "rule_id": "R-ABDOM-01",
                "urgency_level": 1,
                "urgency_name": "Immediate (Resuscitation)",
                "department": "Emergency Resuscitation Bay",
                "escalate_to_human": true,
                "citation_text": "Protocol R-ABDOM-01: Acute severe abdomen presenting with involuntary rigidity, hemodynamic collapse, active GI hemorrhage, or suspected ruptured ectopic pregnancy triggers immediate emergency surgical evaluation.",
                "reasoning": "Peritoneal signs, hemodynamic instability, or suspected surgical abdomen."
            }

        has_focal_or_migration = flags.get("focal_rlq_or_ruq") is True or any("right side" in s or "lower right" in s or "sharp" in s or "appendix" in s for s in symptoms)
        if has_focal_or_migration:
            return {
                "rule_id": "R-ABDOM-02",
                "urgency_level": 3,
                "urgency_name": "Urgent",
                "department": "Emergency Department - Acute Assessment",
                "escalate_to_human": true,
                "citation_text": "Protocol R-ABDOM-02: Progressive focal abdominal pain with migration to RLQ or RUQ warrants urgent diagnostic laboratory and ultrasound/CT imaging for acute appendicitis, cholecystitis, or nephrolithiasis.",
                "reasoning": "Focal right-sided or progressive abdominal pain requiring imaging."
            }

        return {
            "rule_id": "R-ABDOM-03",
            "urgency_level": 4,
            "urgency_name": "Less Urgent",
            "department": "Urgent Care Clinic",
            "escalate_to_human": false,
            "citation_text": "Protocol R-ABDOM-03: Mild crampy abdominal discomfort without focal tenderness, peritoneal signs, or bloody stool is appropriate for outpatient or urgent care symptomatic management.",
            "reasoning": "Mild non-peritoneal abdominal discomfort."
        }

    # 6. DEFAULT ESCALATION FOR AMBIGUOUS OR HIGH RISK CASES
    return {
        "rule_id": "R-ESCALATE-01",
        "urgency_level": 2,
        "urgency_name": "Emergent",
        "department": "Emergency Department - Acute Assessment",
        "escalate_to_human": true,
        "citation_text": "Protocol R-ESCALATE-01: The triage system identified critical informational gaps or elevated risk indicators that cannot be safely reconciled by outpatient heuristic rules. Mandated immediate bedside triage nurse or physician evaluation.",
        "reasoning": "Ambiguous, high-risk, or non-categorized walk-in presentation requiring direct clinical judgment."
    }
