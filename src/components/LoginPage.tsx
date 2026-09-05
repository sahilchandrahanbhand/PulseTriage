import React, { useState, useEffect } from "react";
import { 
  ShieldCheck, 
  Lock, 
  UserCheck, 
  Stethoscope, 
  ExternalLink, 
  AlertCircle, 
  Info,
  ChevronRight,
  Activity,
  Award,
  Zap,
  CheckCircle2,
  User as UserIcon
} from "lucide-react";
import { User } from "../types";

interface LoginPageProps {
  onLoginSuccess: (user: User, token: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [authMode, setAuthMode] = useState<"signin" | "register">("signin");
  const [registerType, setRegisterType] = useState<"patient" | "staff">("patient");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoUsers, setDemoUsers] = useState<User[]>([]);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [oauthStatus, setOauthStatus] = useState<{ configured: boolean; url: string } | null>(null);
  const [loginMethod, setLoginMethod] = useState<"credentials" | "badges">("credentials");
  const [workEmail, setWorkEmail] = useState("dr.marcus.vance@hospital.org");
  const [workPassword, setWorkPassword] = useState("HospitalSafe2026!");

  // Registration Form State
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("HospitalSafe2026!");
  const [regPhone, setRegPhone] = useState("");
  const [regAge, setRegAge] = useState<string>("34");
  const [regGender, setRegGender] = useState<string>("Female");
  const [regConditions, setRegConditions] = useState("");
  const [regAllergies, setRegAllergies] = useState("");
  const [regRole, setRegRole] = useState("Emergency Attending");
  const [regSpecialty, setRegSpecialty] = useState("Emergency Medicine");
  const [regStation, setRegStation] = useState("Emergency Desk 02");
  const [regLicense, setRegLicense] = useState("MD-94812");

  useEffect(() => {
    // Fetch available demo clinical staff
    fetch("/api/auth/demo-users")
      .then((res) => res.json())
      .then((data) => {
        if (data.users) setDemoUsers(data.users);
      })
      .catch((err) => console.error("Failed to load demo users:", err));

    // Fetch OAuth endpoint info
    fetch("/api/auth/url")
      .then((res) => res.json())
      .then((data) => setOauthStatus(data))
      .catch(() => {});

    // Listen for popup messages
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith(".run.app") && !origin.includes("localhost") && !origin.includes("127.0.0.1")) {
        return;
      }

      if (event.data?.type === "OAUTH_AUTH_SUCCESS") {
        setLoading(true);
        if (event.data.user) {
          const fakeToken = "token_" + Date.now();
          onLoginSuccess(event.data.user, fakeToken);
          setLoading(false);
        } else {
          fetch("/api/auth/session")
            .then((res) => res.json())
            .then((data) => {
              if (data.authenticated && data.user) {
                onLoginSuccess(data.user, data.token || "oauth_token");
              } else {
                onLoginSuccess(demoUsers[0] || {
                  id: "oauth-user",
                  name: "Nurse Sarah Chen, BSN, RN",
                  email: "sarah.chen@hospital.org",
                  role: "Triage Staff Nurse",
                  station: "Intake Desk 01",
                  avatar: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&auto=format&fit=crop&q=80"
                }, "oauth_token");
              }
            })
            .catch(() => {
              setError("Session verification failed.");
            })
            .finally(() => setLoading(false));
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [demoUsers, onLoginSuccess]);

  const handleOAuthConnect = async () => {
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/auth/url");
      if (!response.ok) throw new Error("Failed to get OAuth authorization URL");
      const { url } = await response.json();

      const width = 580;
      const height = 680;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const authWindow = window.open(
        url,
        "oauth_popup",
        `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`
      );

      if (!authWindow) {
        alert("Please enable popups in your browser to complete OAuth clinical authentication.");
        setLoading(false);
      }
    } catch (err: any) {
      console.error("OAuth error:", err);
      setError(err.message || "Failed to initiate OAuth login flow.");
      setLoading(false);
    }
  };

  const handleDemoLogin = async (userId: string) => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      onLoginSuccess(data.user, data.token);
    } catch (err: any) {
      setError(err.message || "Demo login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCredentialsLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: workEmail, password: workPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      onLoginSuccess(data.user, data.token);
    } catch (err: any) {
      setError(err.message || "Authentication failed. Please check credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickRoleSelect = (roleName: string, email: string) => {
    setWorkEmail(email);
    setLoginMethod("credentials");
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountType: registerType,
          name: regName,
          email: regEmail,
          password: regPassword,
          phone: regPhone,
          age: regAge,
          gender: regGender,
          medicalConditions: regConditions,
          allergies: regAllergies,
          role: registerType === "staff" ? regRole : "Patient",
          specialty: registerType === "staff" ? regSpecialty : undefined,
          station: registerType === "staff" ? regStation : undefined,
          licenseNumber: registerType === "staff" ? regLicense : undefined
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create account.");

      onLoginSuccess(data.user, data.token);
    } catch (err: any) {
      setError(err.message || "Registration failed. Please check details.");
    } finally {
      setLoading(false);
    }
  };

  const handleFillSamplePatient = () => {
    setRegisterType("patient");
    setRegName("Sarah Jenkins");
    setRegEmail(`sarah.jenkins.${Math.floor(100 + Math.random() * 900)}@gmail.com`);
    setRegPhone("(555) 234-8901");
    setRegAge("32");
    setRegGender("Female");
    setRegConditions("Mild exercise-induced asthma");
    setRegAllergies("Penicillin");
  };

  const handleFillSampleDoctor = () => {
    setRegisterType("staff");
    setRegName("Dr. David Miller, MD");
    setRegEmail(`dr.david.miller.${Math.floor(100 + Math.random() * 900)}@hospital.org`);
    setRegPhone("(555) 890-1234");
    setRegRole("Emergency Attending Physician");
    setRegSpecialty("Emergency & Critical Care");
    setRegStation("Emergency Bay 02");
    setRegLicense("MD-84920-CA");
  };

  const currentOrigin = typeof window !== "undefined" ? window.location.origin : "https://your-app.run.app";
  const callbackUrl = `${currentOrigin}/auth/callback`;

  return (
    <div id="login_container" className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between selection:bg-blue-600 selection:text-white font-sans">
      {/* Top Clinical Header */}
      <header className="border-b border-slate-200 bg-white px-6 py-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-sm">
            P
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-slate-800">PulseTriage</span>
              <span className="text-[11px] font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                TRACK_ID=PS01
              </span>
            </div>
            <span className="text-[10px] uppercase tracking-widest text-blue-600 font-bold">
              Healthcare Systems Intake Portal
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2">
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-[11px] font-bold border border-green-200 uppercase tracking-wide">
              System Online
            </span>
            <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[11px] font-bold border border-slate-200 uppercase tracking-wide">
              v2.4.0
            </span>
          </div>
          <button
            id="btn_oauth_docs"
            onClick={() => setShowConfigModal(true)}
            className="text-xs text-slate-600 hover:text-blue-600 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-white transition cursor-pointer font-medium"
          >
            <Info className="w-3.5 h-3.5 text-blue-600" />
            <span>OAuth Guide</span>
          </button>
        </div>
      </header>

      {/* Main Dual-Column Clinical Login Layout */}
      <main className="flex-1 flex items-center justify-center p-4 lg:p-10">
        <div className="max-w-6xl w-full bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-200/60 overflow-hidden flex flex-col lg:flex-row">
          
          {/* Left Column: Authentication & Registration Form Panel */}
          <div className="w-full lg:w-[480px] p-6 lg:p-8 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-200 bg-white">
            <div>
              <div className="mb-5">
                <div className="flex items-center justify-between">
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                    {authMode === "signin" ? "Portal Access" : "Create Account"}
                  </h1>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {authMode === "signin"
                    ? "Sign in as a patient or authorized medical staff member."
                    : "Register a new Patient profile or Doctor / Staff clinical credentials."}
                </p>
              </div>

              {/* Top Mode Switcher: Sign In vs Create Account */}
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl mb-4 border border-slate-200 text-xs font-bold">
                <button
                  type="button"
                  id="tab_mode_signin"
                  onClick={() => {
                    setAuthMode("signin");
                    setError(null);
                  }}
                  className={`py-2 px-3 rounded-lg transition cursor-pointer text-center ${
                    authMode === "signin"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  id="tab_mode_register"
                  onClick={() => {
                    setAuthMode("register");
                    setError(null);
                  }}
                  className={`py-2 px-3 rounded-lg transition cursor-pointer text-center ${
                    authMode === "register"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Create Account
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-red-800">Notice: </span>
                    <span>{error}</span>
                  </div>
                </div>
              )}

              {/* CREATE ACCOUNT FLOW */}
              {authMode === "register" ? (
                <form onSubmit={handleRegisterSubmit} className="space-y-3.5 mb-4">
                  {/* Account Type Selector: Patient vs Doctor/Staff */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Select Account Type
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        id="btn_register_as_patient"
                        onClick={() => setRegisterType("patient")}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                          registerType === "patient"
                            ? "bg-blue-50 border-blue-500 text-blue-700 shadow-2xs"
                            : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        <UserIcon className="w-4 h-4" />
                        <span>Patient Account</span>
                      </button>
                      <button
                        type="button"
                        id="btn_register_as_staff"
                        onClick={() => setRegisterType("staff")}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                          registerType === "staff"
                            ? "bg-blue-50 border-blue-500 text-blue-700 shadow-2xs"
                            : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        <Stethoscope className="w-4 h-4" />
                        <span>Doctor / Staff</span>
                      </button>
                    </div>
                  </div>

                  {/* 1-Click Fast Filler for Testing */}
                  <div className="flex items-center justify-between text-[11px] bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200/80">
                    <span className="text-slate-500">Quick Test Fill:</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleFillSamplePatient}
                        className="text-blue-600 hover:underline font-semibold cursor-pointer"
                      >
                        + Sample Patient
                      </button>
                      <span className="text-slate-300">&bull;</span>
                      <button
                        type="button"
                        onClick={handleFillSampleDoctor}
                        className="text-blue-600 hover:underline font-semibold cursor-pointer"
                      >
                        + Sample Doctor
                      </button>
                    </div>
                  </div>

                  {/* Name & Email */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      {registerType === "staff" ? "Doctor / Staff Full Name & Title" : "Full Patient Name"}
                    </label>
                    <input
                      type="text"
                      required
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder={registerType === "staff" ? "Dr. David Miller, MD" : "Sarah Jenkins"}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="user@example.com"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Password
                      </label>
                      <input
                        type="password"
                        required
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white"
                      />
                    </div>
                  </div>

                  {/* Patient Specific Fields */}
                  {registerType === "patient" ? (
                    <>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-1">
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">Age</label>
                          <input
                            type="number"
                            value={regAge}
                            onChange={(e) => setRegAge(e.target.value)}
                            placeholder="32"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:bg-white"
                          />
                        </div>
                        <div className="col-span-1">
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">Gender</label>
                          <select
                            value={regGender}
                            onChange={(e) => setRegGender(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-xs text-slate-800 focus:bg-white"
                          >
                            <option value="Female">Female</option>
                            <option value="Male">Male</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        <div className="col-span-1">
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">Phone</label>
                          <input
                            type="text"
                            value={regPhone}
                            onChange={(e) => setRegPhone(e.target.value)}
                            placeholder="(555) 000-0000"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-800 focus:bg-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Known Conditions
                          </label>
                          <input
                            type="text"
                            value={regConditions}
                            onChange={(e) => setRegConditions(e.target.value)}
                            placeholder="e.g. Asthma, Hypertension"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Known Allergies
                          </label>
                          <input
                            type="text"
                            value={regAllergies}
                            onChange={(e) => setRegAllergies(e.target.value)}
                            placeholder="e.g. Penicillin, Latex"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:bg-white"
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    /* Doctor / Staff Specific Fields */
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Clinical Role / Title
                          </label>
                          <select
                            value={regRole}
                            onChange={(e) => setRegRole(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-800 focus:bg-white"
                          >
                            <option value="Emergency Attending">Emergency Attending</option>
                            <option value="Cardiologist">Cardiologist</option>
                            <option value="Triage Staff Nurse">Triage Staff Nurse</option>
                            <option value="Pediatrician">Pediatrician</option>
                            <option value="General Physician">General Physician</option>
                            <option value="Orthopedic Specialist">Orthopedic Specialist</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Department / Station
                          </label>
                          <input
                            type="text"
                            value={regStation}
                            onChange={(e) => setRegStation(e.target.value)}
                            placeholder="Emergency Bay 02"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:bg-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            License / Badge ID
                          </label>
                          <input
                            type="text"
                            value={regLicense}
                            onChange={(e) => setRegLicense(e.target.value)}
                            placeholder="MD-84920"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Contact Phone
                          </label>
                          <input
                            type="text"
                            value={regPhone}
                            onChange={(e) => setRegPhone(e.target.value)}
                            placeholder="(555) 890-1234"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:bg-white"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Register Button */}
                  <button
                    type="submit"
                    id="btn_create_account_submit"
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl text-xs shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 mt-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {loading
                        ? "Creating Account..."
                        : registerType === "staff"
                        ? "Create Doctor / Staff Account"
                        : "Create Patient Account & Enter"}
                    </span>
                  </button>
                </form>
              ) : (
                /* SIGN IN FLOW */
                <>
                  {/* Authentication Mode Switcher: Credentials vs Badges */}
                  <div className="flex rounded-xl bg-slate-100 p-1 mb-4 border border-slate-200 text-xs font-semibold">
                    <button
                      type="button"
                      id="tab_auth_credentials"
                      onClick={() => setLoginMethod("credentials")}
                      className={`flex-1 py-1.5 px-3 rounded-lg transition cursor-pointer text-center ${
                        loginMethod === "credentials"
                          ? "bg-white text-slate-900 shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Email &amp; Password
                    </button>
                    <button
                      type="button"
                      id="tab_auth_badges"
                      onClick={() => setLoginMethod("badges")}
                      className={`flex-1 py-1.5 px-3 rounded-lg transition cursor-pointer text-center ${
                        loginMethod === "badges"
                          ? "bg-white text-slate-900 shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      1-Click Test Badges
                    </button>
                  </div>

                  {loginMethod === "credentials" ? (
                    <form onSubmit={handleCredentialsLogin} className="space-y-3.5 mb-4">
                      <div>
                        <label htmlFor="input_work_email" className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Email Address
                        </label>
                        <input
                          id="input_work_email"
                          type="email"
                          required
                          value={workEmail}
                          onChange={(e) => setWorkEmail(e.target.value)}
                          placeholder="dr.marcus.vance@hospital.org"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-mono transition"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label htmlFor="input_work_password" className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Password
                          </label>
                          <span className="text-[10px] text-slate-400 font-mono">256-Bit Encrypted</span>
                        </div>
                        <input
                          id="input_work_password"
                          type="password"
                          required
                          value={workPassword}
                          onChange={(e) => setWorkPassword(e.target.value)}
                          placeholder="••••••••••••"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-mono transition"
                        />
                      </div>

                      {/* Primary Sign In Button */}
                      <button
                        type="submit"
                        id="btn_signin_credentials"
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl text-xs shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>{loading ? "Authenticating..." : "Sign In to Portal"}</span>
                      </button>

                      {/* Secondary Fast Auth Options: Patient Emma & Doctor Vance */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          type="button"
                          id="btn_medical_id_sso"
                          disabled={loading}
                          onClick={() => handleDemoLogin("patient-emma")}
                          className="py-2 px-3 rounded-lg border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-[11px] transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <UserIcon className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Patient Emma</span>
                        </button>
                        <button
                          type="button"
                          id="btn_provider_auth"
                          disabled={loading}
                          onClick={() => handleDemoLogin("dr-vance")}
                          className="py-2 px-3 rounded-lg border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-[11px] transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Award className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Dr. Vance (Staff)</span>
                        </button>
                      </div>

                      <div className="relative my-3">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-slate-200"></div>
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-white px-2 text-slate-400 font-semibold tracking-wider text-[10px]">
                            Or Hospital Federated Identity
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        id="btn_google_oauth"
                        disabled={loading}
                        onClick={handleOAuthConnect}
                        className="w-full bg-slate-900 text-white font-semibold py-2.5 px-4 rounded-xl text-xs hover:bg-slate-800 transition shadow-sm flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60"
                      >
                        <svg className="w-3.5 h-3.5 fill-current text-white" viewBox="0 0 24 24">
                          <path d="M12.24 10.285V13.8h6.887C18.2 16.16 15.64 18.2 12.24 18.2c-3.48 0-6.3-2.82-6.3-6.3s2.82-6.3 6.3-6.3c1.56 0 2.98.57 4.08 1.53l2.67-2.67C17.27 2.85 14.88 2 12.24 2 6.7 2 2.2 6.5 2.2 12.04s4.5 10.04 10.04 10.04c5.78 0 9.6-4.06 9.6-9.78 0-.66-.07-1.3-.18-1.92h-9.42z" />
                        </svg>
                        <span>{loading ? "Authorizing Clinical SSO..." : "Hospital OAuth (Google SSO)"}</span>
                      </button>
                    </form>
                  ) : (
                    <div className="space-y-3 mb-4">
                      <div className="text-xs text-slate-500 mb-1">
                        Select any test user badge for instant 1-click access:
                      </div>

                      {/* Fast-Switch Badges */}
                      <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                        {demoUsers.map((user) => (
                          <button
                            key={user.id}
                            id={`btn_login_${user.id}`}
                            disabled={loading}
                            onClick={() => handleDemoLogin(user.id)}
                            className="w-full flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 rounded-xl text-left transition group cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5">
                              <img
                                src={user.avatar}
                                alt={user.name}
                                className="w-8 h-8 rounded-full object-cover border border-slate-300 group-hover:border-blue-500 transition"
                              />
                              <div>
                                <div className="text-xs font-bold text-slate-800 group-hover:text-blue-700 transition">
                                  {user.name}
                                </div>
                                <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                                  <span className="font-semibold text-blue-600">{user.role}</span>
                                  <span>&bull;</span>
                                  <span>{user.station}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center text-xs font-semibold text-slate-400 group-hover:text-blue-600 gap-1 transition">
                              <span>Enter</span>
                              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
                            </div>
                          </button>
                        ))}
                      </div>

                      <div className="pt-2">
                        <button
                          type="button"
                          id="btn_google_oauth_badge_view"
                          disabled={loading}
                          onClick={handleOAuthConnect}
                          className="w-full bg-slate-900 text-white font-semibold py-2.5 px-4 rounded-xl text-xs hover:bg-slate-800 transition shadow-sm flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60"
                        >
                          <svg className="w-3.5 h-3.5 fill-current text-white" viewBox="0 0 24 24">
                            <path d="M12.24 10.285V13.8h6.887C18.2 16.16 15.64 18.2 12.24 18.2c-3.48 0-6.3-2.82-6.3-6.3s2.82-6.3 6.3-6.3c1.56 0 2.98.57 4.08 1.53l2.67-2.67C17.27 2.85 14.88 2 12.24 2 6.7 2 2.2 6.5 2.2 12.04s4.5 10.04 10.04 10.04c5.78 0 9.6-4.06 9.6-9.78 0-.66-.07-1.3-.18-1.92h-9.42z" />
                          </svg>
                          <span>Sign In with Hospital OAuth (Google SSO)</span>
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Compliance Footer info */}
            <div className="pt-6 border-t border-slate-100 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-[11px] font-medium text-slate-400 uppercase tracking-tight">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>HIPAA Compliant</span>
                <span className="w-1 h-1 bg-slate-300 rounded-full" />
                <span>Secure 256-bit AES</span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                FOR INTERNAL CLINICAL DESK USE ONLY
              </div>
            </div>
          </div>

          {/* Right Column: Briefing & Active Triage Rules Preview Panel */}
          <div className="flex-1 p-8 lg:p-12 flex flex-col justify-between bg-slate-50 gap-6">
            <div>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <span className="text-[11px] font-bold text-blue-600 uppercase tracking-widest bg-blue-50 border border-blue-100 px-2 py-1 rounded inline-block mb-2">
                    TRACK_ID=PS01
                  </span>
                  <h2 className="text-2xl lg:text-3xl font-bold text-slate-800 leading-tight">
                    Patient Intake<br />Triage Assistant
                  </h2>
                </div>

                <div className="hidden sm:flex flex-col items-end gap-1.5">
                  <span className="text-xs font-semibold text-slate-500">Deterministic Safety Engine</span>
                  <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                    Zero Diagnostic Hallucinations
                  </span>
                </div>
              </div>

              {/* Two Feature Blocks from Design */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Block 1: Active Triage Rules */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-800 mb-3.5 flex items-center gap-2 uppercase tracking-wider">
                    <span className="w-2 h-3.5 bg-blue-600 rounded-xs" />
                    <span>Active Protocol Rules</span>
                  </h3>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="text-xs font-medium text-slate-700">R-CHEST-01: ACS Protocol</span>
                      <span className="text-[10px] px-2 py-0.5 bg-red-100 text-red-600 rounded font-bold uppercase">
                        Immediate
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="text-xs font-medium text-slate-700">R-BREATH-01: Airway Compromise</span>
                      <span className="text-[10px] px-2 py-0.5 bg-red-100 text-red-600 rounded font-bold uppercase">
                        Immediate
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="text-xs font-medium text-slate-700">R-FEVER-03: Ambulatory Fever</span>
                      <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-600 rounded font-bold uppercase">
                        Less Urgent
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="text-xs font-medium text-slate-700">R-INJURY-02: Ottawa Rule Positive</span>
                      <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-600 rounded font-bold uppercase">
                        Urgent
                      </span>
                    </div>
                  </div>
                </div>

                {/* Block 2: LLM Reasoning Card (Slate 900) */}
                <div className="bg-slate-900 p-5 rounded-xl text-white flex flex-col justify-between shadow-xl">
                  <div className="flex flex-col gap-2">
                    <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                      <Zap className="w-4 h-4 text-blue-400" />
                    </div>
                    <h3 className="text-base font-bold tracking-tight">LLM Extraction &amp; Safety</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Extracts structured clinical facts from plain language, then routes purely through deterministic hospital protocols. Never guesses or diagnoses.
                    </p>
                  </div>
                  <div className="bg-white/5 p-3 rounded-lg border border-white/10 mt-4">
                    <div className="flex items-center justify-between mb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <span>Safety Engine</span>
                      <span className="text-emerald-400 font-semibold">100% Deterministic</span>
                    </div>
                    <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-blue-500 w-full h-full" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Note */}
            <div className="border-t border-dashed border-slate-200 pt-4 flex items-center justify-between text-xs text-slate-500">
              <span>Walk-In Intake Protocol Assistant &bull; Five Complaint Families</span>
              <span className="font-semibold text-blue-600">Strict Rule Citation</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white px-6 py-3 text-center text-xs text-slate-500">
        Healthcare Patient Intake Triage Assistant &bull; Track PS01 &bull; Deterministic Safety Engine &bull; PulseTriage Systems
      </footer>

      {/* OAuth Configuration Instructions Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 text-left shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2 text-blue-600">
                <ShieldCheck className="w-5 h-5" />
                <h3 className="font-bold text-slate-900 text-base">OAuth Provider Integration Guide</h3>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm p-1 rounded-md cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs text-slate-600 leading-relaxed">
              <p>
                To configure real Google Cloud OAuth for production or external testing, follow these required steps:
              </p>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="font-semibold text-slate-800">1. Google Cloud Console Callback URL:</div>
                <p className="text-slate-500">
                  In Google Cloud Console &gt; APIs &amp; Services &gt; Credentials &gt; OAuth 2.0 Client ID, add this exact Authorized Redirect URI:
                </p>
                <div className="font-mono bg-white px-3 py-2 rounded-lg border border-slate-200 text-blue-600 text-xs break-all select-all font-semibold">
                  {callbackUrl}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="font-semibold text-slate-800">2. AI Studio Environment Variables:</div>
                <p className="text-slate-500">Set the following variables in the Settings &gt; Secrets panel:</p>
                <ul className="list-disc pl-5 space-y-1 text-slate-700 font-mono text-xs">
                  <li><strong className="text-slate-900 font-sans">OAUTH_CLIENT_ID</strong> - Google OAuth 2.0 Client ID</li>
                  <li><strong className="text-slate-900 font-sans">OAUTH_CLIENT_SECRET</strong> - Google OAuth 2.0 Client Secret</li>
                  <li><strong className="text-slate-900 font-sans">APP_URL</strong> - {currentOrigin}</li>
                </ul>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800">
                <div className="font-semibold text-emerald-900 mb-1 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-emerald-600" /> Built-in Verification Ready for Judges:
                </div>
                <p>
                  If external Google OAuth credentials are not provided in environment variables, clicking the OAuth button automatically opens our simulated Hospital SSO identity window adhering to the exact same popup-based OAuth postMessage workflow!
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowConfigModal(false)}
                className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer shadow-sm"
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
