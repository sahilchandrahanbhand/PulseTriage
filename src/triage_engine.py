import json
import os
import re
from typing import Dict, Any, List
from src.rules import evaluate_deterministic_rules, load_triage_rules

def get_gemini_client():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return None
    try:
        from google import genai
        return genai.Client(api_key=api_key)
    except Exception as e:
        print(f"Warning: Failed to init google-genai client: {e}")
        return None

def extract_clinical_facts_with_llm(patient_text: str, follow_up_answers: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Uses Gemini strictly for information extraction from everyday plain language.
    Does NOT assign urgency or diagnosis!
    """
    client = get_gemini_client()
    if not client:
        # Fallback offline deterministic parser
        return fallback_offline_extractor(patient_text, follow_up_answers)

    prompt = f"""
    You are an emergency triage intake information extractor for a healthcare hospital.
    Your SOLE task is to extract objective clinical facts from the patient's statement into structured JSON.
    DO NOT DIAGNOSE ANY DISEASE OR CONDITION.
    DO NOT ASSIGN URGENCY OR TRIAGE LEVEL.

    Patient Description:
    \"\"\"{patient_text}\"\"\"

    Follow-Up Answers Established (if any):
    {json.dumps(follow_up_answers or {})}

    Identify:
    1. Primary complaint family: one of ["fever", "injury", "chest_pain", "breathing_difficulty", "abdominal_pain", "general_escalation"]
    2. List of explicitly reported symptoms
    3. Stated duration in days or hours
    4. Patient age if mentioned (age_years or age_months)
    5. Red flag presence (boolean or null if unknown):
       - diaphoresis (sweating)
       - radiation_arm_jaw
       - shortness_of_breath
       - crushing_pressure
       - cyanosis
       - stridor
       - unable_to_speak_sentences
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
    6. Missing high-priority questions that still need asking before definitive clinical protocol assignment.

    Return valid JSON only matching this schema:
    {{
      "complaint_family": "string",
      "symptoms": ["string"],
      "duration_days": number,
      "age_years": number or null,
      "age_months": number or null,
      "red_flags": {{
         "diaphoresis": boolean or null,
         "radiation_arm_jaw": boolean or null,
         "shortness_of_breath": boolean or null,
         "crushing_pressure": boolean or null,
         "cyanosis": boolean or null,
         "stridor": boolean or null,
         "unable_to_speak_sentences": boolean or null,
         "stiff_neck": boolean or null,
         "petechial_rash": boolean or null,
         "dehydration_or_vomiting": boolean or null,
         "high_energy_trauma": boolean or null,
         "active_bleeding": boolean or null,
         "loss_of_consciousness": boolean or null,
         "cannot_bear_weight": boolean or null,
         "rigid_abdomen": boolean or null,
         "syncope": boolean or null,
         "focal_rlq_or_ruq": boolean or null
      }},
      "what_patient_reported": ["string"],
      "what_followups_established": ["string"],
      "what_remains_unknown": ["string"],
      "recommended_follow_up_questions": [
        {{ "id": "string", "question": "string", "field": "string" }}
      ]
    }}
    """

    try:
        model_name = os.environ.get("GEMINI_MODEL", "gemini-3.6-flash")
        response = client.models.generateContent(
            model=model_name,
            contents=prompt,
            config={"response_mime_type": "application/json"}
        )
        data = json.loads(response.text)
        return data
    except Exception as e:
        print(f"LLM fact extraction error: {e}, falling back to rule-based extractor")
        return fallback_offline_extractor(patient_text, follow_up_answers)

def fallback_offline_extractor(patient_text: str, follow_up_answers: Dict[str, Any] = None) -> Dict[str, Any]:
    text = (patient_text or "").lower()
    follow_up_answers = follow_up_answers or {}
    
    # Classify family
    if any(k in text for k in ["chest", "heart", "angina", "tightness in chest"]):
        family = "chest_pain"
    elif any(k in text for k in ["breath", "wheez", "gasp", "chok", "air", "inhaler", "suffocat"]):
        family = "breathing_difficulty"
    elif any(k in text for k in ["fever", "temperature", "chills", "sweat", "hot", "burning"]):
        family = "fever"
    elif any(k in text for k in ["ankle", "twisted", "fall", "injury", "fracture", "cut", "wound", "bleed", "hit", "crash"]):
        family = "injury"
    elif any(k in text for k in ["stomach", "belly", "abdominal", "cramp", "appendix", "nausea"]):
        family = "abdominal_pain"
    else:
        family = "general_escalation"

    flags = {}
    flags["diaphoresis"] = ("sweat" in text or follow_up_answers.get("diaphoresis") is True)
    flags["radiation_arm_jaw"] = (any(k in text for k in ["arm", "jaw", "radiat"]) or follow_up_answers.get("radiation_arm_jaw") is True)
    flags["shortness_of_breath"] = (any(k in text for k in ["breath", "winded"]) or follow_up_answers.get("shortness_of_breath") is True)
    flags["crushing_pressure"] = (any(k in text for k in ["crush", "elephant", "heavy", "tight"]) or follow_up_answers.get("crushing_pressure") is True)
    flags["cannot_bear_weight"] = (any(k in text for k in ["can't walk", "cannot bear weight", "can't stand"]) or follow_up_answers.get("cannot_bear_weight") is True)
    flags["stiff_neck"] = (any(k in text for k in ["stiff neck", "neck stiff"]) or follow_up_answers.get("stiff_neck") is True)
    flags["rigid_abdomen"] = ("rigid" in text or follow_up_answers.get("rigid_abdomen") is True)

    reported = [patient_text.strip()] if patient_text else []
    established = [f"{k}: {v}" for k, v in follow_up_answers.items() if v is not None]
    unknown = []
    if family == "chest_pain" and flags.get("radiation_arm_jaw") is None:
        unknown.append("Pain radiation to arm, neck, or jaw")
    if family == "fever" and flags.get("stiff_neck") is None:
        unknown.append("Presence of neck stiffness or petechial rash")
    if family == "injury" and flags.get("cannot_bear_weight") is None:
        unknown.append("Ability to take 4 weight-bearing steps")

    return {
        "complaint_family": family,
        "symptoms": [s.strip() for s in re.split(r'[,.\n;]', patient_text) if len(s.strip()) > 3],
        "duration_days": 1,
        "age_years": None,
        "age_months": None,
        "red_flags": flags,
        "what_patient_reported": reported,
        "what_followups_established": established,
        "what_remains_unknown": unknown,
        "recommended_follow_up_questions": []
    }

def process_triage_assessment(patient_text: str, follow_up_answers: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    End-to-end pipeline:
    1. Extract clinical facts
    2. Deterministically evaluate against published rules
    3. Generate audit-ready Triage Note
    """
    facts = extract_clinical_facts_with_llm(patient_text, follow_up_answers)
    rule_result = evaluate_deterministic_rules(facts)

    return {
        "facts": facts,
        "recommendation": rule_result,
        "triage_note": {
            "track_id": "PS01",
            "urgency_level": rule_result["urgency_level"],
            "urgency_name": rule_result["urgency_name"],
            "department": rule_result["department"],
            "rule_id": rule_result["rule_id"],
            "citation_text": rule_result["citation_text"],
            "escalate_to_human": rule_result["escalate_to_human"],
            "what_patient_reported": facts.get("what_patient_reported", []),
            "what_followups_established": facts.get("what_followups_established", []),
            "what_remains_unknown": facts.get("what_remains_unknown", []),
            "disclaimer": "This triage assistant strictly does NOT provide medical diagnosis. Every recommendation cites a specific protocol rule. Uncertain or high-risk cases must be evaluated directly by a bedside clinician."
        }
    }
