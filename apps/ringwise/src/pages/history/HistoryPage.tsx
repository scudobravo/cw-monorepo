import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Clock, Phone, TrendingUp, MessageSquare, Sparkles, Loader2 } from "lucide-react";
import AppShell from "../../components/layout/AppShell";
import { useAuthStore } from "../../stores/authStore";
import { type SessionRow } from "../../lib/api";
import { listSessionsDirect, getTopQuestionsDirect } from "../../lib/supabase";

const PRODUCT_FILTER = "RingWise" as const;

function modeLabel(mode: string): string {
  return (
    {
      sales_call: "Sales Call",
      discovery: "Discovery",
      demo: "Demo",
      negotiation: "Negotiation",
      follow_up: "Follow-up",
    }[mode] ?? mode.replace(/_/g, " ")
  );
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

interface QuestionRow {
  id: string;
  text: string;
  asked_count: number;
  mode: string;
}

export default function HistoryPage() {
  const { token } = useAuthStore();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token()) {
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
    ]).then(([s, q]) => {
      setSessions(s);
      setQuestions(q as QuestionRow[]);
      setLoading(false);
    });
  }, [token]);

  return (
    <AppShell>
      <div className="page-container fade-in">
        <div className="page-header">
          <div>
            <h1 className="page-title">Call History</h1>
            <p className="page-subtitle">
              Review past sessions and the objections your AI handled automatically.
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

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div>
            <div className="section-label" style={{ marginBottom: "10px" }}>
              Recent sessions
            </div>
            <div className="card" style={{ padding: "4px 0" }}>
              {loading ? (
                <div
                  style={{
                    padding: "32px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "10px",
                    color: "var(--text-4)",
                    fontSize: "12px",
                  }}
                >
                  <Loader2
                    size={22}
                    style={{ animation: "spin 0.85s linear infinite", color: "var(--accent-light)" }}
                  />
                  <span>Caricamento sessioni…</span>
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
                  Nessuna sessione RingWise ancora. Avvia una chiamata per vedere qui la cronologia.
                </div>
              ) : (
                sessions.map((s, i) => (
                  <Link
                    key={s.id}
                    to={`/session-summary/${s.id}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "10px 16px",
                      borderBottom:
                        i < sessions.length - 1 ? "1px solid var(--border-1)" : "none",
                      textDecoration: "none",
                      color: "inherit",
                    }}
                  >
                    <div
                      style={{
                        width: 30,
                        height: 30,
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
                      <Phone size={13} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-1)" }}>
                        {modeLabel(s.mode)}
                      </div>
                      <div style={{ fontSize: "10px", color: "var(--text-4)" }}>
                        {formatDate(s.started_at)}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: "11px",
                          color: "var(--text-3)",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        <Clock size={11} />
                        {formatDurationSecs(s.duration_secs)}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: "11px",
                          color: "var(--text-3)",
                        }}
                      >
                        <MessageSquare size={11} />
                        {s.total_suggestions ?? 0}
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div>
            <div className="section-label" style={{ marginBottom: "10px" }}>
              Frequent objections &amp; topics
            </div>
            <div className="card" style={{ padding: "4px 0" }}>
              {loading ? (
                <div
                  style={{
                    padding: "32px",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    color: "var(--text-4)",
                  }}
                >
                  <Loader2
                    size={22}
                    style={{ animation: "spin 0.85s linear infinite", color: "var(--accent-light)" }}
                  />
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
                  <span>
                    Le obiezioni gestite dall&apos;AI compariranno qui dopo le sessioni.
                  </span>
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
                          overflow: "hidden",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
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
