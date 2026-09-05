import os
import time
import secrets
from typing import Dict, Optional, Any

# In-memory session store for healthcare clinical staff sessions
SESSIONS: Dict[str, Dict[str, Any]] = {}

DEFAULT_DEMO_USERS = [
    {
        "id": "staff-01",
        "name": "Sarah Chen, BSN, RN",
        "email": "sarah.chen@hospital.org",
        "role": "Triage Staff Nurse",
        "station": "Intake Desk 01",
        "avatar": "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&auto=format&fit=crop&q=80"
    },
    {
        "id": "staff-02",
        "name": "Dr. Marcus Vance, MD",
        "email": "marcus.vance@hospital.org",
        "role": "Emergency Attending",
        "station": "Resuscitation Bay Lead",
        "avatar": "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150&auto=format&fit=crop&q=80"
    },
    {
        "id": "staff-03",
        "name": "Alex Rivera",
        "email": "alex.rivera@hospital.org",
        "role": "Patient Access Specialist",
        "station": "Registration & Ambulatory Triage",
        "avatar": "https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=150&auto=format&fit=crop&q=80"
    }
]

def create_session_for_user(user: Dict[str, Any]) -> str:
    token = secrets.token_urlsafe(32)
    SESSIONS[token] = {
        "token": token,
        "user": user,
        "created_at": time.time(),
        "expires_at": time.time() + 86400  # 24 hours
    }
    return token

def get_session(token: Optional[str]) -> Optional[Dict[str, Any]]:
    if not token or token not in SESSIONS:
        return None
    sess = SESSIONS[token]
    if time.time() > sess["expires_at"]:
        del SESSIONS[token]
        return None
    return sess

def remove_session(token: str):
    if token in SESSIONS:
        del SESSIONS[token]
