import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Clock,
  Code2,
  PhoneCall,
  BrainCircuit,
  LayoutTemplate,
  Activity,
  Loader2,
  MessageSquare,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import AppShell from "../../components/layout/AppShell";
import { useAuthStore } from "../../stores/authStore";
import {
  getDrillsStats,
  parseVocalCoachingScorecard,
  type DrillStats,
  type SessionRow,
} from "../../lib/api";
import { listSessionsDirect, getTopQuestionsDirect } from "../../lib/supabase";

const PRODUCT_FILTER = "DevOracle" as const;

function modeLabel(mode: string): string {
  const map: Record<string, string> = {
    coding_interview: "Coding Interview",
    mock_interview: "Mock Interview",
    behavioral_tech: "Behavioral",
    system_design: "System Design",
    sales_call: "Sales Call",
    discovery: "Discovery",
    demo: "Demo",
    negotiation: "Negotiation",
    follow_up: "Follow-up",
  };
  return map[mode] ?? mode.replace(/_/g, " ");
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("it-IT", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDurationSecs(secs: number | null | undefined): string {
  if (secs == null || Number.isNaN(secs)) return "—";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function modeIcon(mode: string) {
  if (mode.includes("sales") || mode === "discovery" || mode === "demo")
    return <PhoneCall size={14} />;
  if (mode.includes("system") || mode.includes("design")) return <LayoutTemplate size={14} />;
  if (mode.includes("mock") || mode.includes("behavioral")) return <BrainCircuit size={14} />;
  if (mode.includes("coding")) return <Code2 size={14} />;
  return <Activity size={14} />;
}

interface QuestionRow {
  id: string;
  text: string;
  asked_count: number;
  mode: string;
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const { token } = useAuthStore();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drillStats, setDrillStats] = useState<DrillStats | null>(null);

  useEffect(() => {
    const t = token();
    if (!t) {
      setLoading(false);
      return;
    }

    setError(null);
    Promise.all([
      listSessionsDirect(PRODUCT_FILTER).catch((e) => {
        setError(String(e));
        return [] as SessionRow[];
      }),
      getTopQuestionsDirect(PRODUCT_FILTER, 8).catch(() => []),
      getDrillsStats(t).catch(() => null),
    ]).then(([s, q, d]) => {
      setSessions(s);
      setQuestions(q as QuestionRow[]);
      if (d) setDrillStats(d);
      setLoading(false);
    });
  }, [token]);

  return (
    <AppShell>
      <div className="page fade-in">
        <div className="page-header">
          <div>
            <h1 className="page-title">History</h1>
            <p className="page-subtitle">Sessioni passate (DevOracle)</p>
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

        {drillStats && (
          <div
            className="card"
            style={{
              marginBottom: "16px",
              padding: "14px 18px",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "12px 28px",
              fontSize: "13px",
              color: "var(--text-2)",
            }}
          >
            <div className="section-label" style={{ width: "100%", marginBottom: "4px" }}>
              Drill stats
            </div>
            <span>
              <strong style={{ color: "var(--text-1)" }}>Cards due today:</strong>{" "}
              {drillStats.due}
            </span>
            <span style={{ color: "var(--border-2)" }}>|</span>
            <span>
              <strong style={{ color: "var(--text-1)" }}>Total in deck:</strong>{" "}
              {drillStats.total}
            </span>
            <span style={{ color: "var(--border-2)" }}>|</span>
            <span>
              <strong style={{ color: "var(--text-1)" }}>Current streak:</strong>{" "}
              {drillStats.streak} {drillStats.streak === 1 ? "day" : "days"}
            </span>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div>
            <div className="section-header" style={{ marginBottom: "10px" }}>
              <span className="section-title">Sessioni recenti</span>
            </div>
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              {loading ? (
                <div
                  style={{
                    padding: "36px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "10px",
                    color: "var(--text-4)",
                    fontSize: "12px",
                  }}
                >
                  <Loader2 size={22} className="history-loader-spin" style={{ color: "var(--accent-light)" }} />
                  <span>Caricamento…</span>
                </div>
              ) : sessions.length === 0 ? (
                <div
                  style={{
                    padding: "28px 20px",
                    textAlign: "center",
                    color: "var(--text-4)",
                    fontSize: "12px",
                    lineHeight: 1.5,
                  }}
                >
                  Nessuna sessione DevOracle. Avvia una sessione dalla home per vederla qui.
                </div>
              ) : (
                sessions.map((s, i) => (
                  <div
                    key={s.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/session-summary/${s.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ")
                        navigate(`/session-summary/${s.id}`);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "12px 16px",
                      borderBottom:
                        i < sessions.length - 1 ? "1px solid var(--border-1)" : undefined,
                      cursor: "pointer",
                    }}
                  >
                    <div className="mode-card-icon accent" style={{ flexShrink: 0 }}>
                      {modeIcon(s.mode)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "13px",
                          fontWeight: 600,
                          color: "var(--text-1)",
                          marginBottom: "2px",
                        }}
                      >
                        {modeLabel(s.mode)}
                      </div>
                      <div
                        style={{
                          fontSize: "11px",
                          color: "var(--text-3)",
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          flexWrap: "wrap",
                        }}
                      >
                        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <Clock size={10} />
                          {formatDate(s.started_at)}
                        </span>
                        <span>·</span>
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {formatDurationSecs(s.duration_secs)}
                        </span>
                        <span>·</span>
                        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <MessageSquare size={10} />
                          {s.total_suggestions ?? 0} cue
                        </span>
                        {(() => {
                          const v = parseVocalCoachingScorecard(s.scorecard);
                          if (!v) return null;
                          return (
                            <>
                              <span>·</span>
                              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                                Avg WPM: {v.avg_wpm}
                              </span>
                              <span>·</span>
                              <span>Filler words: {v.filler_words_total}</span>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <div className="section-header" style={{ marginBottom: "10px" }}>
              <span className="section-title">Domande frequenti</span>
            </div>
            <div className="card" style={{ padding: "4px 0" }}>
              {loading ? (
                <div
                  style={{
                    padding: "36px",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Loader2 size={22} className="history-loader-spin" style={{ color: "var(--accent-light)" }} />
                </div>
              ) : questions.length === 0 ? (
                <div
                  style={{
                    padding: "24px",
                    textAlign: "center",
                    color: "var(--text-4)",
                    fontSize: "12px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <Sparkles size={20} style={{ opacity: 0.3 }} />
                  <span>Nessuna domanda in classifica per ora.</span>
                </div>
              ) : (
                questions.map((q, i) => (
                  <div
                    key={q.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                      padding: "10px 16px",
                      borderBottom:
                        i < questions.length - 1 ? "1px solid var(--border-1)" : "none",
                    }}
                  >
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: "var(--r-sm)",
                        background: "var(--accent-dim)",
                        border: "1px solid var(--accent-border)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        marginTop: "1px",
                      }}
                    >
                      <TrendingUp size={10} style={{ color: "var(--accent-light)" }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "var(--text-2)",
                          lineHeight: 1.5,
                        }}
                      >
                        {q.text}
                      </div>
                      <div style={{ fontSize: "10px", color: "var(--text-4)", marginTop: "2px" }}>
                        {modeLabel(q.mode)}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        color: "var(--accent-light)",
                        background: "var(--accent-dim)",
                        border: "1px solid var(--accent-border)",
                        borderRadius: "10px",
                        padding: "2px 7px",
                        flexShrink: 0,
                      }}
                    >
                      ×{q.asked_count}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
