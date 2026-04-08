import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  Copy,
  Loader2,
  Mail,
  MessageSquare,
  Target,
  TrendingUp,
  X,
} from "lucide-react";
import AppShell from "../../components/layout/AppShell";
import { useAuthStore } from "../../stores/authStore";
import {
  getSession,
  postFollowUpEmail,
  postSessionScorecard,
  type CallScorecard,
  type SessionRow,
} from "../../lib/api";

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
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
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

function scoreHue(overall: number): string {
  if (overall >= 7) return "var(--accent)";
  if (overall >= 4) return "var(--amber)";
  return "var(--red)";
}

export type SessionSummaryLocationState = {
  transcript_segments: { text: string; speaker?: string; timestamp?: string }[];
  suggestions: { suggestion_type: string; content: string }[];
  talk_ratio_user: number;
  mode: string;
  duration_secs?: number;
  started_at?: string;
};

export default function SessionSummaryPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [card, setCard] = useState<CallScorecard | null>(null);
  const [meta, setMeta] = useState<SessionRow | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailErr, setEmailErr] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId || !token()) {
      setLoading(false);
      return;
    }

    const nav = location.state as SessionSummaryLocationState | null;

    let cancelled = false;
    (async () => {
      setErr(null);
      setLoading(true);
      try {
        const t = token()!;
        if (nav?.transcript_segments && nav.suggestions) {
          const res = await postSessionScorecard(t, sessionId, {
            transcript_segments: nav.transcript_segments,
            suggestions: nav.suggestions,
            talk_ratio_user: nav.talk_ratio_user,
            mode: nav.mode,
          });
          if (!cancelled) {
            setCard(res.scorecard);
            setMeta(res.session);
          }
        } else {
          const s = await getSession(t, sessionId);
          if (!cancelled) {
            setMeta(s);
            if (s.scorecard && typeof s.scorecard === "object") {
              setCard(s.scorecard as unknown as CallScorecard);
            } else {
              setErr(
                "Nessuno scorecard salvato per questa sessione. Generane uno chiudendo la chiamata dalla Session page.",
              );
            }
          }
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Errore");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, location.key]);

  const navState = location.state as SessionSummaryLocationState | null;
  const duration =
    meta?.duration_secs ??
    navState?.duration_secs ??
    null;
  const started =
    meta?.started_at ?? navState?.started_at ?? "";
  const mode = meta?.mode ?? navState?.mode ?? "";

  const headerTitle = `Call recap — ${modeLabel(mode)} · ${started ? formatDate(started) : "—"} · ${formatDurationSecs(duration)}`;

  const followUp = meta?.follow_up_email;
  const hasFollowUpEmail =
    !!followUp &&
    typeof followUp.subject === "string" &&
    followUp.subject.trim().length > 0 &&
    typeof followUp.body === "string" &&
    followUp.body.trim().length > 0;

  async function handleGenerateFollowUpEmail() {
    if (!sessionId || !token()) return;
    setEmailLoading(true);
    setEmailErr(null);
    try {
      const nav = location.state as SessionSummaryLocationState | null;
      const res = await postFollowUpEmail(token()!, sessionId, {
        transcript_segments: nav?.transcript_segments,
      });
      const generatedAt = new Date().toISOString();
      setMeta((prev) =>
        prev
          ? {
              ...prev,
              follow_up_email: {
                subject: res.subject,
                body: res.body,
                generated_at: generatedAt,
              },
            }
          : null,
      );
    } catch (e) {
      setEmailErr(e instanceof Error ? e.message : "Errore generazione email");
    } finally {
      setEmailLoading(false);
    }
  }

  function copyFollowUpToClipboard() {
    if (!followUp) return;
    const text = `${followUp.subject}\n\n${followUp.body}`;
    void navigator.clipboard.writeText(text);
  }

  function openFollowUpInMailApp() {
    if (!followUp) return;
    const subject = encodeURIComponent(followUp.subject);
    const body = encodeURIComponent(followUp.body);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  return (
    <AppShell>
      <div className="page-container fade-in">
        <div className="page-header" style={{ alignItems: "flex-start" }}>
          <div>
            <h1 className="page-title" style={{ fontSize: "18px", lineHeight: 1.35 }}>
              {headerTitle}
            </h1>
            <p className="page-subtitle">Scorecard generata da AI</p>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate("/history")}
          >
            <ArrowLeft size={14} />
            Back to history
          </button>
        </div>

        {loading && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              color: "var(--text-4)",
              marginTop: "24px",
            }}
          >
            <Loader2
              size={20}
              style={{
                animation: "spin 0.85s linear infinite",
                color: "var(--accent-light)",
              }}
            />
            Generazione scorecard…
          </div>
        )}

        {err && !loading && (
          <div
            style={{
              marginTop: "16px",
              padding: "12px 14px",
              borderRadius: "var(--r-md)",
              background: "var(--red-dim)",
              border: "1px solid rgba(239,68,68,0.25)",
              color: "var(--red)",
              fontSize: "13px",
            }}
          >
            {err}
          </div>
        )}

        {!loading && card && (
          <div style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "8px" }}>
              <div
                style={{
                  width: 132,
                  height: 132,
                  borderRadius: "50%",
                  border: `4px solid ${scoreHue(card.overall_score)}`,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "var(--bg-elevated)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
                }}
              >
                <span style={{ fontSize: "11px", color: "var(--text-4)", textTransform: "uppercase" }}>
                  Overall
                </span>
                <span
                  style={{
                    fontSize: "36px",
                    fontWeight: 800,
                    color: scoreHue(card.overall_score),
                    fontVariantNumeric: "tabular-nums",
                    lineHeight: 1,
                  }}
                >
                  {card.overall_score}
                  <span style={{ fontSize: "18px", opacity: 0.7 }}>/10</span>
                </span>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "10px",
              }}
            >
              <MetricTile
                icon={<TrendingUp size={16} />}
                label="Talk ratio score"
                value={`${card.talk_ratio_score}/10`}
              />
              <MetricTile
                icon={<MessageSquare size={16} />}
                label="Obiezioni"
                value={`${card.objections_handled} / ${card.objections_total}`}
              />
              <MetricTile
                icon={<Target size={16} />}
                label="Segnali acquisto"
                value={String(card.buying_signals_detected)}
              />
              <MetricTile
                icon={card.next_step_established ? <Check size={16} /> : <X size={16} />}
                label="Next step"
                value={card.next_step_established ? "Sì" : "No"}
                accent={card.next_step_established ? "var(--accent-light)" : "var(--text-4)"}
              />
            </div>

            <section>
              <div className="section-label" style={{ marginBottom: "8px" }}>
                What went well
              </div>
              <ul style={{ margin: 0, paddingLeft: "18px", color: "var(--accent-light)", fontSize: "13px", lineHeight: 1.6 }}>
                {card.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </section>

            <section>
              <div className="section-label" style={{ marginBottom: "8px" }}>
                To improve
              </div>
              <ul style={{ margin: 0, paddingLeft: "18px", color: "var(--amber)", fontSize: "13px", lineHeight: 1.6 }}>
                {card.improvements.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </section>

            <section>
              <div className="section-label" style={{ marginBottom: "8px" }}>
                Your next move
              </div>
              <div
                className="card"
                style={{
                  padding: "16px 18px",
                  border: "2px solid var(--accent)",
                  background: "rgba(16, 185, 129, 0.08)",
                  fontSize: "14px",
                  lineHeight: 1.55,
                  color: "var(--text-1)",
                  fontWeight: 500,
                }}
              >
                {card.recommended_action}
              </div>
            </section>

            <section>
              <div className="section-label" style={{ marginBottom: "8px" }}>
                Summary
              </div>
              <p style={{ margin: 0, fontSize: "13px", color: "var(--text-2)", lineHeight: 1.65 }}>
                {card.call_summary}
              </p>
            </section>

            <button
              type="button"
              className="btn btn-primary"
              style={{ alignSelf: "flex-start", marginTop: "8px" }}
              onClick={() => navigate("/history")}
            >
              Back to history
            </button>
          </div>
        )}

        {!loading && meta && (
          <section style={{ marginTop: card ? "28px" : "24px" }}>
            <div className="section-label" style={{ marginBottom: "10px" }}>
              Follow-up email
            </div>
            {emailErr && (
              <div
                style={{
                  marginBottom: "8px",
                  padding: "10px 12px",
                  borderRadius: "var(--r-md)",
                  background: "var(--red-dim)",
                  border: "1px solid rgba(239,68,68,0.25)",
                  color: "var(--red)",
                  fontSize: "13px",
                }}
              >
                {emailErr}
              </div>
            )}
            {!hasFollowUpEmail && (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={emailLoading || !sessionId}
                  onClick={() => void handleGenerateFollowUpEmail()}
                  style={{ alignSelf: "flex-start", gap: "8px" }}
                >
                  {emailLoading ? (
                    <>
                      <Loader2
                        size={16}
                        style={{
                          animation: "spin 0.85s linear infinite",
                          color: "var(--accent-light)",
                        }}
                      />
                      Generating…
                    </>
                  ) : (
                    "Generate email"
                  )}
                </button>
              </div>
            )}
            {hasFollowUpEmail && followUp && (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div
                  className="card"
                  style={{
                    padding: "16px 18px",
                    background: "rgba(15, 23, 42, 0.85)",
                    border: "1px solid rgba(148, 163, 184, 0.15)",
                    fontFamily:
                      'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                    fontSize: "13px",
                    lineHeight: 1.55,
                    color: "var(--text-2)",
                    fontWeight: 400,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      color: "var(--text-1)",
                      marginBottom: "12px",
                      fontSize: "14px",
                    }}
                  >
                    {followUp.subject}
                  </div>
                  <div style={{ whiteSpace: "pre-wrap" }}>{followUp.body}</div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ gap: "8px" }}
                    onClick={copyFollowUpToClipboard}
                  >
                    <Copy size={14} />
                    Copy to clipboard
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ gap: "8px" }}
                    onClick={openFollowUpInMailApp}
                  >
                    <Mail size={14} />
                    Open in Mail app
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </AppShell>
  );
}

function MetricTile({
  icon,
  label,
  value,
  accent,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div
      className="card"
      style={{
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", color: accent ?? "var(--accent-light)" }}>
        {icon}
        <span style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-4)" }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-1)", fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
    </div>
  );
}
