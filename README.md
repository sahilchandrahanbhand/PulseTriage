TRACK_ID=PS01

# Patient Intake Triage Assistant (NexusTiQ 24)

A clinical walk-in intake desk assistant engineered for rapid, safe, and explainable triage routing. Patients arriving at intake describe their situation in everyday, incomplete language. This assistant takes plain-language complaints, asks targeted clinical follow-up questions when critical red flags or missing fields are detected, and evaluates the case against published deterministic clinical triage protocols covering five major walk-in complaint families: **fever**, **injury/trauma**, **chest pain**, **breathing difficulty**, and **abdominal pain**.

The system produces a comprehensive, audit-ready **Triage Note** with recommended urgency level, target department, exact rule citation, patient reported facts, established follow-up findings, and unestablished/unknown parameters.

> **CRITICAL CLINICAL BOUNDARY:** The system strictly **DOES NOT DIAGNOSE** diseases. Every routing decision is determined by deterministic logic over the published rule set (`data/triage_rules.json`). Gemini (`gemini-3.6-flash` / `gemini-3.8-flash`) is used strictly to extract structured clinical facts from plain language and formulate empathetic follow-ups. Any uncertain, ambiguous, or high-risk case triggers mandatory escalation to a human clinician.

---

## Key Features

1. **Secure Healthcare Staff Authentication & OAuth Integration:**
   - Intake clerk and triage nurse authentication via Google OAuth 2.0 / OpenID Connect.
   - Clinical staff fast-switch and role badges (Intake Clerk, Triage RN, Emergency Attending).
   - Session tracking with audit logging for every generated triage note.

2. **Plain-Language Symptom Intake:**
   - Free-form text input allowing everyday patient descriptions (e.g., *"chest feels heavy and I broke into a cold sweat"*, *"twisted my ankle playing pickup basketball"*).
   - Instant 1-click test scenario presets for judges:
     - **Ordinary path:** Fever for 2 days in an alert adult.
     - **Difficult / Red-flag path:** Chest tightness with diaphoresis or respiratory distress.
     - **Trauma path:** Twisted ankle with Ottawa positive weight-bearing deficit.
     - **Ambiguous path:** Diffuse fatigue with incomplete vitals triggering human escalation.

3. **Dynamic Targeted Follow-Up Questions:**
   - If red-flag screening questions remain unanswered (e.g., radiation of chest pain, neck stiffness in fever, ability to bear weight), the assistant immediately prompts targeted questions before finalizing triage.

4. **Deterministic Rule Engine (Clear Separation of LLM & Rules):**
   - Pure boolean evaluation engine matching structured facts against published protocols (`R-CHEST-01`, `R-BREATH-01`, `R-FEVER-01`, `R-INJURY-01`, `R-ABDOM-01`, `R-ESCALATE-01`).
   - LLM failure or API timeout falls back gracefully to deterministic escalation without crashing.

5. **Structured Triage Note:**
   - **Urgency Level:** Level 1 (Immediate / Resuscitation), Level 2 (Emergent), Level 3 (Urgent), Level 4 (Less Urgent), Level 5 (Non-Urgent).
   - **Recommended Department:** (Emergency Resuscitation Bay, Acute ED, Pediatric Emergency, Fast Track, Urgent Care, Walk-In Ambulatory).
   - **Rule Citation:** Explicit protocol ID and rationale.
   - **Structured Contrast:** Patient Reported vs. Follow-ups Established vs. What Remains Unknown.
   - **EHR Export:** Copy note or JSON to clipboard.

---

## Submission & Running Instructions

### 1. Requirements

- Python 3.10+ / Python 3.11
- Modern web browser

### 2. Quickstart (One Command)

From the repository root:

```bash
pip install -r requirements.txt
python app.py
```

Open `http://localhost:8000` in your web browser.

The Python server (`src/server.py` via `app.py`) serves the unified application:
- FastAPI backend on port 8000
- Pre-built frontend static assets from `dist/` or `frontend/dist/`
- Full REST endpoints for `/api/triage/analyze`, `/api/triage/follow-up`, and `/api/auth/session`

### 3. Environment Variables

| Variable | Description | Required |
|---|---|---|
| `GEMINI_API_KEY` | Gemini API key for structured fact extraction (`gemini-3.6-flash` or `gemini-3.8-flash`) | Yes (read from environment) |
| `PORT` | Web server port (defaults to `8000`) | Optional |
| `OAUTH_CLIENT_ID` | OAuth 2.0 Client ID for Google Workspace/Auth | Optional (Demo auth enabled by default) |
| `OAUTH_CLIENT_SECRET` | OAuth 2.0 Client Secret | Optional |
| `APP_URL` | Base URL for OAuth callback redirects | Optional |

---

## Repository Structure

```
.
├── TRACK_ID=PS01
├── app.py                     # Entry point (python app.py starts server on port 8000)
├── requirements.txt           # Python dependencies (FastAPI, uvicorn, pydantic, google-genai, numpy)
├── README.md                  # Hackathon documentation and submission guide
├── data/
│   └── triage_rules.json      # Published knowledge base covering the 5 walk-in families
├── src/
│   ├── rules.py               # Deterministic rule evaluator (boolean logic, no LLM guesswork)
│   ├── triage_engine.py       # GenAI fact extractor + rule grounding pipeline
│   ├── auth.py                # Staff authentication, OAuth token validation, session management
│   ├── server.py              # FastAPI server hosting REST API and static client
│   └── ...                    # Frontend components & Vite TypeScript application
└── dist/                      # Production compiled frontend bundle
```

---

## Demo Cases to Show (Evaluation Walkthrough)

### Case 1: Normal / Ordinary Path (Uncomplicated Fever)
- **Patient input:** *"I've had a fever since yesterday and feel wiped out, throat is a bit scratchy."*
- **Follow-up:** Checks for neck stiffness, rash, age, and oral intake tolerance.
- **Outcome:** **Level 4 - Less Urgent** routed to **Walk-In Ambulatory Clinic**.
- **Citation:** `Protocol R-FEVER-03`.
- **Note:** Explicitly documents that patient reported fever/malaise, follow-up confirmed no meningeal signs or dehydration, and no disease diagnosis was made.

### Case 2: Difficult / Red-Flag Path (High-Risk Chest Pain)
- **Patient input:** *"My chest feels really tight, I'm sweating bullets and feel kind of dizzy."*
- **Follow-up:** Immediate red-flag detection.
- **Outcome:** **Level 1 - Immediate (Resuscitation)** routed to **Emergency Resuscitation Bay**.
- **Citation:** `Protocol R-CHEST-01`.
- **Escalation:** Flagged with immediate red alert for bedside human clinician handoff.

---

## Architectural & Ethical Safeguards

- **No Diagnostic Hallucinations:** The LLM's system prompt restricts it to entity extraction (symptoms, duration, severity, red-flag presence). Routing decisions are strictly executed by deterministic code.
- **Silence is a Finding:** If a critical parameter (e.g. chest pain radiation, pediatric age, weight-bearing ability) is not confirmed negative, it remains `unknown` and cannot be downgraded to routine care.
- **Offline / Degraded Fallback:** If network connection or the Gemini API is unavailable, the fallback deterministic keyword/regex matcher classifies and cites the protocols safely.

---

## Demo Video

[Link to 2-3 minute demo video demonstrating normal path and high-risk difficult path]
