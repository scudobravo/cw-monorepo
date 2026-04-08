import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Phone,
  Search,
  Monitor,
  Handshake,
  Mail,
  PlayCircle,
  TrendingUp,
  MessageSquare,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import AppShell from "../../components/layout/AppShell";
import { useSessionStore } from "../../stores/sessionStore";
import { useAuthStore } from "../../stores/authStore";
import type { CallMode } from "../../lib/tauri";

interface ModeCard {
  mode: CallMode;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const CALL_MODES: ModeCard[] = [
  {
    mode: "sales_call",
    label: "Sales Call",
    description: "Live coaching for outbound prospecting calls. Get real-time objection handling, talk-ratio nudges, and next-step prompts.",
    icon: <Phone size={18} />,
  },
  {
    mode: "discovery",
    label: "Discovery Call",
    description: "Surface the right questions to uncover pain, budget, authority, and timeline. Never miss a BANT signal.",
    icon: <Search size={18} />,
  },
  {
    mode: "demo",
    label: "Demo",
    description: "Keep the narrative tight during product demos. Get cues when to probe for reactions and when to advance.",
    icon: <Monitor size={18} />,
  },
  {
    mode: "negotiation",
    label: "Negotiation",
    description: "Defend your price with confidence. Real-time counters, anchor-point suggestions, and silence coaching.",
    icon: <Handshake size={18} />,
  },
  {
    mode: "follow_up",
    label: "Follow-up",
    description: "Structured debrief for post-call follow-ups. Summarise commitments, next steps, and send-worthy email drafts.",
    icon: <Mail size={18} />,
  },
];

const STAT_ROWS = [
  { label: "Avg talk ratio (you)", value: "—", sub: "target < 50%", icon: <MessageSquare size={13} /> },
  { label: "Objections handled", value: "—", sub: "this week",      icon: <AlertCircle size={13} /> },
  { label: "Win rate (tracked)", value: "—", sub: "all time",       icon: <TrendingUp size={13} /> },
];

export default function HomePage() {
  const navigate = useNavigate();
  const { startSession, isLoading, error } = useSessionStore();
  const { user } = useAuthStore();

  const firstName = user?.email?.split("@")[0] ?? "there";

  const handleStart = async (mode: CallMode) => {
    await startSession({ product: "RingWise", mode });
    navigate("/session");
  };

  // Redirect to session if one is already running
  const { session } = useSessionStore();
  useEffect(() => {
    if (session) navigate("/session", { replace: true });
  }, [session, navigate]);

  return (
    <AppShell>
      <div className="page-container fade-in">
        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Hey {firstName} 👋</h1>
            <p className="page-subtitle">
              Pick a call type to get real-time AI coaching. Cue listens, you close.
            </p>
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: "10px 14px",
              background: "var(--red-dim)",
              border: "1px solid rgba(239,68,68,0.22)",
              borderRadius: "var(--r-md)",
              color: "var(--red)",
              fontSize: "12px",
              marginBottom: "16px",
            }}
          >
            {error}
          </div>
        )}

        {/* Call mode grid */}
        <div className="section-label" style={{ marginBottom: "10px" }}>
          Start a session
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: "10px",
            marginBottom: "28px",
          }}
        >
          {CALL_MODES.map((card) => (
            <button
              key={card.mode}
              onClick={() => handleStart(card.mode)}
              disabled={isLoading}
              className="card mode-card"
              style={{
                textAlign: "left",
                cursor: "pointer",
                transition: "all var(--t-base)",
              }}
            >
              <div
                className="mode-card-icon emerald"
                style={{ marginBottom: "10px" }}
              >
                {card.icon}
              </div>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--text-1)",
                  marginBottom: "4px",
                }}
              >
                {card.label}
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-3)", lineHeight: 1.5 }}>
                {card.description}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  marginTop: "12px",
                  fontSize: "11px",
                  color: "var(--accent-light)",
                  fontWeight: 600,
                }}
              >
                <PlayCircle size={12} />
                Start
                <ChevronRight size={10} style={{ marginLeft: "auto", opacity: 0.5 }} />
              </div>
            </button>
          ))}
        </div>

        {/* Stats */}
        <div className="section-label" style={{ marginBottom: "10px" }}>
          Your performance
        </div>
        <div className="card" style={{ padding: "4px 0" }}>
          {STAT_ROWS.map((row, i) => (
            <div
              key={row.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 16px",
                borderBottom:
                  i < STAT_ROWS.length - 1 ? "1px solid var(--border-1)" : "none",
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "var(--r-md)",
                  background: "var(--accent-dim)",
                  border: "1px solid var(--accent-border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--accent-light)",
                  flexShrink: 0,
                }}
              >
                {row.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "12px", color: "var(--text-2)", fontWeight: 500 }}>
                  {row.label}
                </div>
                <div style={{ fontSize: "10px", color: "var(--text-4)" }}>{row.sub}</div>
              </div>
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: 700,
                  color: "var(--text-1)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {row.value}
              </div>
            </div>
          ))}
        </div>

        <p
          style={{
            fontSize: "11px",
            color: "var(--text-4)",
            marginTop: "8px",
            textAlign: "center",
          }}
        >
          Stats populate after your first completed session.
        </p>
      </div>
    </AppShell>
  );
}
