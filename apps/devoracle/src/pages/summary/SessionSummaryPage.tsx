import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Loader2,
  BookOpen,
} from "lucide-react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import AppShell from "../../components/layout/AppShell";
import { useAuthStore } from "../../stores/authStore";
import {
  getSession,
  parseVocalCoachingScorecard,
  postInterviewScorecard,
  type InterviewScorecard,
  type SessionRow,
} from "../../lib/api";

export type InterviewSummaryLocationState = {
  transcript_segments: { text: string; speaker?: string; timestamp?: string }[];
  suggestions: { suggestion_type: string; content: string }[];
  mode: string;
  talk_ratio_user?: number;
  hints_used?: number;
};

function modeLabel(mode: string): string {
  return (
    {
      coding_interview: "Coding Interview",
      mock_interview: "Mock Interview",
      system_design: "System Design",
      sales_call: "Sales Call",
      discovery: "Discovery",
    }[mode] ?? mode.replace(/_/g, " ")
  );
}

function levelStyle(level: InterviewScorecard["estimated_level"]): {
  bg: string;
  color: string;
  border: string;
} {
  switch (level) {
    case "junior":
      return {
        bg: "rgba(34, 197, 94, 0.12)",
        color: "var(--green)",
        border: "1px solid rgba(34,197,94,0.35)",
      };
    case "mid":
      return {
        bg: "rgba(59, 130, 246, 0.12)",
        color: "#60a5fa",
        border: "1px solid rgba(59,130,246,0.35)",
      };
    case "senior":
      return {
        bg: "rgba(168, 85, 247, 0.12)",
        color: "#c084fc",
        border: "1px solid rgba(168,85,247,0.35)",
      };
    case "staff":
      return {
        bg: "rgba(245, 158, 11, 0.14)",
        color: "#fbbf24",
        border: "1px solid rgba(245,158,11,0.4)",
      };
    default:
      return {
        bg: "var(--bg-elevated)",
        color: "var(--text-1)",
        border: "1px solid var(--border-1)",
      };
  }
}

function leetcodeSearchUrl(topic: string): string {
  return `https://leetcode.com/problemset/?search=${encodeURIComponent(topic)}`;
}

export default function SessionSummaryPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [card, setCard] = useState<InterviewScorecard | null>(null);
  const [meta, setMeta] = useState<SessionRow | null>(null);

  useEffect(() => {
    if (!sessionId || !token()) {
      setLoading(false);
      return;
    }

    const nav = location.state as InterviewSummaryLocationState | null;
    let cancelled = false;

    (async () => {
      setErr(null);
      setLoading(true);
      try {
        const t = token()!;
        if (
          nav?.transcript_segments?.length &&
          nav?.suggestions &&
          nav?.mode
        ) {
          const res = await postInterviewScorecard(t, sessionId, {
            transcript_segments: nav.transcript_segments,
            suggestions: nav.suggestions,
            mode: nav.mode,
            hints_used: nav.hints_used,
          });
          if (!cancelled) {
            setCard(res.scorecard);
            setMeta(res.session);
          }
        } else {
          const s = await getSession(t, sessionId);
          if (!cancelled) {
            setMeta(s);
            const sc = s.scorecard as Record<string, unknown> | null;
            if (sc && sc._kind === "interview") {
              const { _kind: _k, ...rest } = sc;
              void _k;
              setCard(rest as InterviewScorecard);
            } else {
              setErr(
                "Nessuno scorecard tecnico per questa sessione. Chiudi una sessione DevOracle dalla Session page per generarne uno.",
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

  const radarData = card
    ? [
        { subject: "Problem Solving", score: card.problem_solving },
        { subject: "Code Quality", score: card.code_quality },
        { subject: "Communication", score: card.communication_clarity },
        { subject: "Time Mgmt", score: card.time_management },
        { subject: "Overall", score: card.overall_score },
      ]
    : [];

  const lvl = card ? levelStyle(card.estimated_level) : null;

  const vocalSummary = meta?.scorecard
    ? parseVocalCoachingScorecard(meta.scorecard)
    : null;

  return (
    <AppShell>
      <div className="page-container fade-in">
        <div className="page-header" style={{ alignItems: "flex-start" }}>
          <div>
            <h1 className="page-title" style={{ fontSize: "18px", lineHeight: 1.35 }}>
              Session recap —{" "}
              {meta?.mode ? modeLabel(meta.mode) : "Technical interview"}
            </h1>
            <p className="page-subtitle">Technical scorecard (AI)</p>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate("/history")}
          >
            <ArrowLeft size={14} />
            View history
          </button>
        </div>

        {vocalSummary && (
          <div
            className="card"
            style={{
              marginTop: "16px",
              padding: "12px 16px",
              display: "flex",
              flexWrap: "wrap",
              gap: "16px 24px",
              fontSize: "13px",
              color: "var(--text-2)",
            }}
          >
            <span>
              <strong style={{ color: "var(--text-1)" }}>Avg WPM:</strong>{" "}
              {vocalSummary.avg_wpm}
            </span>
            <span>
              <strong style={{ color: "var(--text-1)" }}>Filler words:</strong>{" "}
              {vocalSummary.filler_words_total}
            </span>
          </div>
        )}

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

        {!loading && card && lvl && (
          <div
            style={{
              marginTop: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "24px",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "20px",
                alignItems: "stretch",
              }}
            >
              <div
                className="card"
                style={{
                  flex: "1 1 280px",
                  minHeight: 280,
                  padding: "16px",
                }}
              >
                <div className="section-label" style={{ marginBottom: "8px" }}>
                  Performance radar
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
                    <PolarGrid stroke="var(--border-1)" />
                    <PolarAngleAxis
                      dataKey="subject"
                      tick={{ fill: "var(--text-3)", fontSize: 11 }}
                    />
                    <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fontSize: 10 }} />
                    <Radar
                      name="Score"
                      dataKey="score"
                      stroke="#6366f1"
                      fill="#6366f1"
                      fillOpacity={0.35}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 200,
                  padding: "24px",
                  borderRadius: "var(--r-md)",
                  background: lvl.bg,
                  border: lvl.border,
                }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "var(--text-4)",
                    marginBottom: "8px",
                  }}
                >
                  Level estimate
                </span>
                <span
                  style={{
                    fontSize: "28px",
                    fontWeight: 800,
                    color: lvl.color,
                    textTransform: "capitalize",
                  }}
                >
                  {card.estimated_level}
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    color: "var(--text-3)",
                    marginTop: "8px",
                    textAlign: "center",
                  }}
                >
                  Approach: {card.approach_quality.replace("_", " ")}
                </span>
              </div>
            </div>

            <div className="card" style={{ padding: "16px 18px" }}>
              <div className="section-label" style={{ marginBottom: "10px" }}>
                Questions
              </div>
              <p style={{ margin: 0, fontSize: "14px", color: "var(--text-1)" }}>
                <strong>{card.questions_attempted}</strong> attempted ·{" "}
                <strong>{card.questions_solved}</strong> solved ·{" "}
                <strong>{card.hints_used}</strong> hints used
              </p>
            </div>

            <section>
              <div className="section-label" style={{ marginBottom: "8px" }}>
                Strengths
              </div>
              <ul style={{ margin: 0, paddingLeft: "18px", listStyle: "none" }}>
                {card.strengths.map((s, i) => (
                  <li
                    key={i}
                    style={{
                      display: "flex",
                      gap: "8px",
                      alignItems: "flex-start",
                      marginBottom: "8px",
                      fontSize: "13px",
                      color: "var(--green)",
                    }}
                  >
                    <CheckCircle size={16} style={{ flexShrink: 0, marginTop: "1px" }} />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <div className="section-label" style={{ marginBottom: "8px" }}>
                To improve
              </div>
              <ul style={{ margin: 0, paddingLeft: "18px", listStyle: "none" }}>
                {card.improvements.map((s, i) => (
                  <li
                    key={i}
                    style={{
                      display: "flex",
                      gap: "8px",
                      alignItems: "flex-start",
                      marginBottom: "8px",
                      fontSize: "13px",
                      color: "var(--amber)",
                    }}
                  >
                    <AlertCircle size={16} style={{ flexShrink: 0, marginTop: "1px" }} />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <div className="section-label" style={{ marginBottom: "10px" }}>
                Study plan
              </div>
              <ul style={{ margin: 0, paddingLeft: "0", listStyle: "none" }}>
                {card.next_study_topics.map((topic, i) => (
                  <li key={i} style={{ marginBottom: "8px" }}>
                    <a
                      href={leetcodeSearchUrl(topic)}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "13px",
                        color: "var(--accent-light)",
                      }}
                    >
                      <BookOpen size={14} />
                      {topic}
                    </a>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <div className="section-label" style={{ marginBottom: "8px" }}>
                Summary
              </div>
              <p style={{ margin: 0, fontSize: "13px", color: "var(--text-2)", lineHeight: 1.65 }}>
                {card.session_summary}
              </p>
            </section>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => navigate("/session")}
              >
                Start another session
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate("/history")}
              >
                View history
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
