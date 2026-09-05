import React, { useState, useRef, useEffect } from "react";
import { 
  Send, 
  Sparkles, 
  User, 
  Calendar, 
  Stethoscope, 
  RefreshCw, 
  AlertCircle,
  Clock,
  Heart
} from "lucide-react";
import { ChatMessage, User as AppUser, ChecklistItem } from "../types";

interface FriendlyCompanionChatProps {
  currentUser: AppUser;
  checklistItems: ChecklistItem[];
  onAddChecklistItem?: (label: string) => void;
  onRequestTriageAnalysis?: (text: string) => void;
  onOpenBooking?: () => void;
  isAnalyzingTriage?: boolean;
}

export const FriendlyCompanionChat: React.FC<FriendlyCompanionChatProps> = ({
  currentUser,
  checklistItems,
  onAddChecklistItem,
  onRequestTriageAnalysis,
  onOpenBooking,
  isAnalyzingTriage = false
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-1",
      sender: "assistant",
      text: `Hi ${currentUser.name.split(" ")[0] || "there"}! 👋 I'm CarePal, your friendly healthcare companion. I'm right here with you! Please tell me what's going on, how you're feeling, or what happened today. Take your time — no rush at all.`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      suggestions: [
        "I'm feeling chest tightness & pressure",
        "Having high fever and chills",
        "Slipped and hurt my leg / cannot walk",
        "Having trouble breathing",
        "Severe abdominal pain"
      ]
    }
  ]);

  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text) return;

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      sender: "user",
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage("");
    setIsTyping(true);

    // Call companion endpoint
    try {
      const res = await fetch("/api/chat/friendly-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          conversationHistory: messages,
          checklist: checklistItems,
          patientInfo: {
            name: currentUser.name,
            age: currentUser.age,
            medicalConditions: currentUser.medicalConditions
          }
        })
      });

      const data = await res.json();
      const assistantReply: ChatMessage = {
        id: `assistant_${Date.now()}`,
        sender: "assistant",
        text: data.reply || "I'm right here with you. Tell me more so we can make sure you're well taken care of.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        suggestions: data.suggestions || [
          "Started 2 hours ago",
          "Pain is 5 out of 10",
          "No fever",
          "Need to see a doctor"
        ]
      };

      setMessages((prev) => [...prev, assistantReply]);

      // If new symptoms were detected, notify checklist
      if (data.detectedSymptoms && Array.isArray(data.detectedSymptoms) && onAddChecklistItem) {
        data.detectedSymptoms.forEach((sym: string) => {
          onAddChecklistItem(sym);
        });
      }
    } catch (err) {
      console.error("Companion chat error:", err);
      const fallbackReply: ChatMessage = {
        id: `assistant_${Date.now()}`,
        sender: "assistant",
        text: "I'm right here by your side! Could you share a bit more about when this started and whether you're experiencing severe pain, shortness of breath, or fever?",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        suggestions: ["Started today", "Pain is severe", "No other symptoms", "I want to see a doctor"]
      };
      setMessages((prev) => [...prev, fallbackReply]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleRunFullAssessment = () => {
    // Collect all patient statements
    const patientTexts = messages
      .filter((m) => m.sender === "user")
      .map((m) => m.text)
      .join(". ");

    const checkedLabels = checklistItems
      .filter((i) => i.checked)
      .map((i) => i.label)
      .join("; ");

    const fullStatement = patientTexts
      ? `${patientTexts}. Checked clinical items: ${checkedLabels || "None"}.`
      : `Patient reported: ${checkedLabels || "Routine intake consultation"}.`;

    if (onRequestTriageAnalysis) {
      onRequestTriageAnalysis(fullStatement);
    }
  };

  return (
    <div id="friendly_companion_chat" className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[520px] overflow-hidden">
      {/* Friendly Chat Header */}
      <div className="px-5 py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white flex items-center justify-between shadow-xs shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center border border-white/30 text-white text-lg">
              🩺
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 border-2 border-indigo-700 rounded-full" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold tracking-tight">CarePal — Friendly Health Companion</h2>
              <span className="text-[10px] bg-white/20 text-white px-2 py-0.2 rounded-full font-medium">
                Online &amp; Listening
              </span>
            </div>
            <p className="text-[11px] text-blue-100 flex items-center gap-1">
              <Heart className="w-3 h-3 text-pink-300 fill-pink-300" />
              <span>Compassionate intake triage &bull; Safe guidance &bull; Non-judgmental</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenBooking && (
            <button
              type="button"
              id="btn_chat_book_doctor"
              onClick={onOpenBooking}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold backdrop-blur-xs transition cursor-pointer border border-white/20"
            >
              <Calendar className="w-3.5 h-3.5 text-blue-200" />
              <span>Book Doctor Slot</span>
            </button>
          )}

          <button
            type="button"
            id="btn_chat_run_triage"
            onClick={handleRunFullAssessment}
            disabled={isAnalyzingTriage}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-blue-50 text-blue-800 text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
          >
            {isAnalyzingTriage ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
            ) : (
              <Stethoscope className="w-3.5 h-3.5 text-blue-600" />
            )}
            <span>Generate Triage Note</span>
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/50">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
          >
            <div
              className={`flex items-start gap-2.5 max-w-[85%] ${
                msg.sender === "user" ? "flex-row-reverse" : "flex-row"
              }`}
            >
              {/* Avatar */}
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                  msg.sender === "user"
                    ? "bg-slate-900 text-white"
                    : "bg-blue-600 text-white shadow-xs"
                }`}
              >
                {msg.sender === "user" ? <User className="w-3.5 h-3.5" /> : "🩺"}
              </div>

              {/* Message Bubble */}
              <div
                className={`p-3.5 rounded-2xl text-xs leading-relaxed shadow-xs ${
                  msg.sender === "user"
                    ? "bg-blue-600 text-white rounded-tr-xs"
                    : "bg-white text-slate-800 border border-slate-200/80 rounded-tl-xs"
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.text}</div>
                <div
                  className={`text-[10px] mt-1.5 flex items-center gap-1 ${
                    msg.sender === "user" ? "text-blue-200 justify-end" : "text-slate-400 justify-start"
                  }`}
                >
                  <Clock className="w-2.5 h-2.5" />
                  <span>{msg.timestamp}</span>
                </div>
              </div>
            </div>

            {/* Quick Suggestion Chips (if assistant) */}
            {msg.suggestions && msg.suggestions.length > 0 && (
              <div className="mt-2.5 ml-9 flex flex-wrap gap-1.5 max-w-[90%]">
                {msg.suggestions.map((sug, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSendMessage(sug)}
                    className="px-2.5 py-1 rounded-full bg-white hover:bg-blue-50 text-blue-700 hover:text-blue-900 border border-blue-200 text-[11px] font-medium transition cursor-pointer shadow-2xs flex items-center gap-1"
                  >
                    <span>💬</span>
                    <span>{sug}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">
              🩺
            </div>
            <div className="p-3 bg-white rounded-2xl border border-slate-200/80 rounded-tl-xs flex items-center gap-1.5 text-slate-500 text-xs shadow-xs">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" />
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]" />
              <span className="ml-1 text-[11px] text-slate-400">CarePal is typing...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form Bar */}
      <div className="p-3 bg-white border-t border-slate-200 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            id="input_chat_companion"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Talk with CarePal (e.g. 'I fell down 2 hours ago and my chest feels tight')..."
            className="flex-1 text-xs px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white text-slate-800 placeholder:text-slate-400"
          />
          <button
            type="submit"
            id="btn_chat_send"
            disabled={!inputMessage.trim() || isTyping}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send</span>
          </button>
        </form>

        <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400 px-1">
          <span className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>Friendly conversational mode active &bull; Syncs with checklist in real time</span>
          </span>
          <span>Press Enter to send</span>
        </div>
      </div>
    </div>
  );
};
