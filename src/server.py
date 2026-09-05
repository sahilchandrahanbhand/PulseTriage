import os
import json
from pathlib import Path
from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, Optional, List

from src.rules import load_triage_rules
from src.triage_engine import process_triage_assessment
from src.auth import (
    DEFAULT_DEMO_USERS,
    create_session_for_user,
    get_session,
    remove_session
)

app = FastAPI(
    title="Healthcare Patient Intake Triage Assistant",
    description="TRACK_ID=PS01 Triage Engine with OAuth and deterministic rule grounding",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TriageRequest(BaseModel):
    patient_description: str
    follow_up_answers: Optional[Dict[str, Any]] = None

class DemoLoginRequest(BaseModel):
    user_id: str

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "track_id": "PS01",
        "service": "Patient Intake Triage Assistant",
        "gemini_api_configured": bool(os.environ.get("GEMINI_API_KEY"))
    }

@app.get("/api/rules")
async def get_rules():
    try:
        rules = load_triage_rules()
        return rules
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/triage/analyze")
async def analyze_triage(req: TriageRequest):
    if not req.patient_description or len(req.patient_description.strip()) < 3:
        raise HTTPException(status_code=400, detail="Patient description must be at least 3 characters.")
    
    result = process_triage_assessment(req.patient_description, req.follow_up_answers)
    return result

@app.get("/api/auth/demo-users")
async def get_demo_users():
    return {"users": DEFAULT_DEMO_USERS}

@app.post("/api/auth/login-demo")
async def login_demo(req: DemoLoginRequest):
    user = next((u for u in DEFAULT_DEMO_USERS if u["id"] == req.user_id), None)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    token = create_session_for_user(user)
    return {"token": token, "user": user}

@app.get("/api/auth/session")
async def get_current_session(request: Request):
    auth_header = request.headers.get("Authorization")
    token = None
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
    
    session = get_session(token)
    if not session:
        return {"authenticated": False, "user": None}
    return {"authenticated": True, "user": session["user"]}

@app.post("/api/auth/logout")
async def logout(request: Request):
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        remove_session(token)
    return {"success": True}

@app.get("/api/auth/url")
async def get_oauth_url(request: Request):
    app_url = os.environ.get("APP_URL", str(request.base_url).rstrip("/"))
    client_id = os.environ.get("OAUTH_CLIENT_ID", "")
    redirect_uri = f"{app_url}/auth/callback"

    if not client_id:
        # Provide interactive mock OAuth URL if no client_id configured in env
        return {
            "url": f"{app_url}/auth/mock-oauth-login?redirect_uri={redirect_uri}",
            "configured": False,
            "message": "OAUTH_CLIENT_ID not configured in secrets. Using built-in healthcare identity provider simulation."
        }

    # Standard Google OAuth 2.0 Authorization Endpoint
    scope = "openid email profile"
    auth_url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={client_id}&"
        f"redirect_uri={redirect_uri}&"
        f"response_type=token&"
        f"scope={scope}&"
        f"prompt=consent"
    )
    return {"url": auth_url, "configured": True}

@app.get("/auth/mock-oauth-login", response_class=HTMLResponse)
async def mock_oauth_page():
    return """
    <!DOCTYPE html>
    <html>
    <head>
      <title>Hospital Staff OAuth 2.0 Portal</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 16px; }
        .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 28px; max-width: 440px; width: 100%; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
        h2 { margin-top: 0; font-size: 1.25rem; display: flex; align-items: center; gap: 8px; color: #38bdf8; }
        p { color: #94a3b8; font-size: 0.9rem; line-height: 1.5; }
        .user-btn { width: 100%; display: flex; align-items: center; gap: 12px; padding: 12px; margin-bottom: 10px; background: #0f172a; border: 1px solid #334155; border-radius: 8px; color: white; cursor: pointer; text-align: left; transition: all 0.2s; }
        .user-btn:hover { border-color: #38bdf8; background: #1e293b; }
        .avatar { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; }
        .role { font-size: 0.75rem; color: #38bdf8; }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>Hospital SSO Identity Provider</h2>
        <p>Authenticate as verified clinical intake staff to proceed:</p>
        <button class="user-btn" onclick="completeAuth('Nurse Sarah Chen, BSN, RN', 'sarah.chen@hospital.org', 'Triage Staff Nurse', 'Intake Desk 01')">
          <img class="avatar" src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&auto=format&fit=crop&q=80">
          <div>
            <div>Nurse Sarah Chen, RN</div>
            <div class="role">Triage Staff Nurse &bull; Station 1</div>
          </div>
        </button>
        <button class="user-btn" onclick="completeAuth('Dr. Marcus Vance, MD', 'marcus.vance@hospital.org', 'Emergency Attending', 'Resuscitation Bay')">
          <img class="avatar" src="https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150&auto=format&fit=crop&q=80">
          <div>
            <div>Dr. Marcus Vance, MD</div>
            <div class="role">Emergency Attending Lead</div>
          </div>
        </button>
        <button class="user-btn" onclick="completeAuth('Alex Rivera', 'alex.rivera@hospital.org', 'Patient Access Specialist', 'Registration')">
          <img class="avatar" src="https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=150&auto=format&fit=crop&q=80">
          <div>
            <div>Alex Rivera</div>
            <div class="role">Patient Access Specialist</div>
          </div>
        </button>
      </div>
      <script>
        function completeAuth(name, email, role, station) {
          const user = { id: 'oauth-' + Date.now(), name, email, role, station };
          if (window.opener) {
            window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', user: user }, '*');
            window.close();
          } else {
            alert('Authenticated! Please return to the triage assistant.');
          }
        }
      </script>
    </body>
    </html>
    """

@app.get(["/auth/callback", "/auth/callback/"], response_class=HTMLResponse)
async def auth_callback():
    """
    OAuth callback handling compliant with iframe preview and popup postMessage
    """
    return """
    <!DOCTYPE html>
    <html>
      <head><title>Authentication Complete</title></head>
      <body style="font-family:sans-serif; background:#0f172a; color:#f8fafc; text-align:center; padding-top:40px;">
        <script>
          if (window.opener) {
            // Extract hash fragment tokens if OAuth response_type=token
            const hash = window.location.hash.substring(1);
            const params = new URLSearchParams(hash);
            const accessToken = params.get('access_token');

            window.opener.postMessage({ 
              type: 'OAUTH_AUTH_SUCCESS',
              token: accessToken
            }, '*');
            window.close();
          } else {
            window.location.href = '/';
          }
        </script>
        <p>Authentication verified. This window will close automatically...</p>
      </body>
    </html>
    """

# Mount static files if dist directory exists
dist_path = Path(__file__).resolve().parent.parent / "dist"
if dist_path.exists():
    app.mount("/assets", StaticFiles(directory=dist_path / "assets"), name="assets")
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = dist_path / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(dist_path / "index.html")
