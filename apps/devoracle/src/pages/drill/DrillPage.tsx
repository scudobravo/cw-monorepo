import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Repeat, Loader2 } from "lucide-react";
import AppShell from "../../components/layout/AppShell";
import { useAuthStore } from "../../stores/authStore";
import {
  getDrillsDue,
  getDrillsAhead,
  getDrillsStats,
  postDrillReview,
  type DrillCardWithQuestion,
  type DrillStats,
} from "../../lib/api";

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

function productLabel(product: string): string {
  if (product === "DevOracle") return "DevOracle";
  if (product === "RingWise") return "RingWise";
  return product;
}

type DeckKind = "due" | "ahead";

export default function DrillPage() {
  const { token } = useAuthStore();
  const [stats, setStats] = useState<DrillStats | null>(null);
  const [queue, setQueue] = useState<DrillCardWithQuestion[]>([]);
  const totalSessionRef = useRef(0);
  const [deckKind, setDeckKind] = useState<DeckKind>("due");
  const [loading, setLoading] = useState(true);
  const [aheadLoading, setAheadLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sessionDone, setSessionDone] = useState(false);

  const refreshStats = useCallback(async () => {
    const t = token();
    if (!t) return;
    try {
      const s = await getDrillsStats(t);
      setStats(s);
    } catch {
      /* ignore */
    }
  }, [token]);

  const loadDue = useCallback(async () => {
    const t = token();
    if (!t) {
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    setSessionDone(false);
    setFlipped(false);
    try {
      const { items } = await getDrillsDue(t, 40);
      totalSessionRef.current = items.length;
      setQueue(items);
      setDeckKind("due");
      await refreshStats();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore di caricamento");
    } finally {
      setLoading(false);
    }
  }, [token, refreshStats]);

  const loadAhead = useCallback(async () => {
    const t = token();
    if (!t) return;
    setAheadLoading(true);
    setError(null);
    setSessionDone(false);
    setFlipped(false);
    try {
      const { items } = await getDrillsAhead(t, 40);
      totalSessionRef.current = items.length;
      setQueue(items);
      setDeckKind("ahead");
      await refreshStats();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore");
    } finally {
      setAheadLoading(false);
    }
  }, [token, refreshStats]);

  useEffect(() => {
    void loadDue();
  }, [loadDue]);

  const current = queue[0];

  useEffect(() => {
    setFlipped(false);
  }, [current?.id]);

  const progressNum = useMemo(() => {
    const total = totalSessionRef.current;
    if (total <= 0) return 0;
    return total - queue.length + 1;
  }, [queue.length]);

  const progressPct =
    totalSessionRef.current > 0
      ? Math.min(100, (progressNum / totalSessionRef.current) * 100)
      : 0;

  async function submitQuality(quality: 1 | 3 | 4 | 5) {
    const t = token();
    if (!t || !current || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await postDrillReview(t, current.id, { quality });
      setQueue((q) => {
        const next = q.slice(1);
        if (next.length === 0) setSessionDone(true);
        return next;
      });
      await refreshStats();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed");
    } finally {
      setSubmitting(false);
    }
  }

  const emptyDue =
    !loading && deckKind === "due" && queue.length === 0 && !sessionDone;
  const emptyAhead =
    !aheadLoading && deckKind === "ahead" && queue.length === 0 && !sessionDone;

  return (
    <AppShell>
      <div className="page fade-in">
        <div className="page-header">
          <div>
            <h1 className="page-title">Drill</h1>
            <p className="page-subtitle">
              Spaced repetition — questions from your bank
            </p>
          </div>
          {stats != null && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "13px",
                fontWeight: 600,
                color: "var(--amber)",
                background: "var(--amber-dim)",
                border: "1px solid rgba(245,158,11,0.25)",
                padding: "6px 12px",
                borderRadius: "var(--r-md)",
              }}
            >
              <span aria-hidden>🔥</span>
              {stats.streak} day{stats.streak === 1 ? "" : "s"} streak
            </div>
          )}
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
            <Loader2 size={20} className="history-loader-spin" />
            Loading deck…
          </div>
        )}

        {!loading && emptyDue && (
          <div className="card" style={{ padding: "32px 24px", textAlign: "center" }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }} aria-hidden>
              🎉
            </div>
            <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-1)", marginBottom: "8px" }}>
              No cards due today. Come back tomorrow!
            </div>
            <p style={{ fontSize: "12px", color: "var(--text-3)", marginBottom: "20px" }}>
              Or study ahead with cards that are not due yet.
            </p>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={aheadLoading}
              onClick={() => void loadAhead()}
            >
              {aheadLoading ? (
                <>
                  <Loader2 size={14} className="history-loader-spin" style={{ marginRight: 6 }} />
                  Loading…
                </>
              ) : (
                <>
                  <Repeat size={14} style={{ marginRight: 6 }} />
                  Study ahead
                </>
              )}
            </button>
          </div>
        )}

        {!loading && emptyAhead && deckKind === "ahead" && (
          <div className="card" style={{ padding: "28px 20px", textAlign: "center", color: "var(--text-3)", fontSize: "13px" }}>
            No upcoming cards in your deck. Add questions from sessions or the bank.
          </div>
        )}

        {!loading && sessionDone && queue.length === 0 && totalSessionRef.current > 0 && (
          <div className="card" style={{ padding: "32px 24px", textAlign: "center" }}>
            <div style={{ fontSize: "36px", marginBottom: "10px" }}>✓</div>
            <div style={{ fontWeight: 600, fontSize: "15px", color: "var(--text-1)" }}>
              Round complete
            </div>
            <button
              type="button"
              className="btn btn-secondary mt-4"
              style={{ marginTop: "16px" }}
              onClick={() => void loadDue()}
            >
              Back
            </button>
          </div>
        )}

        {!loading && current && !sessionDone && (
          <>
            <div style={{ marginBottom: "12px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "11px",
                  color: "var(--text-3)",
                  marginBottom: "6px",
                }}
              >
                <span>
                  Card {progressNum} of {totalSessionRef.current}{" "}
                  {deckKind === "due" ? "due today" : "study ahead"}
                </span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  {Math.round(progressPct)}%
                </span>
              </div>
              <div
                style={{
                  height: 6,
                  borderRadius: 999,
                  background: "var(--bg-elevated)",
                  overflow: "hidden",
                  border: "1px solid var(--border-1)",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${progressPct}%`,
                    background: "linear-gradient(90deg, var(--accent), var(--accent-light))",
                    borderRadius: 999,
                    transition: "width 0.35s var(--ease)",
                  }}
                />
              </div>
            </div>

            <div className="drill-flip-scene" style={{ marginBottom: "20px" }}>
              <button
                type="button"
                className={`drill-flip-inner${flipped ? " is-flipped" : ""}`}
                onClick={() => setFlipped((f) => !f)}
                style={{
                  width: "100%",
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  cursor: "pointer",
                }}
                aria-label={flipped ? "Show question" : "Show answer"}
              >
                <div className="drill-flip-face" style={{ textAlign: "left" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "14px" }}>
                    <span className="badge badge-default">{productLabel(current.question.product)}</span>
                    <span className="badge badge-accent">{modeLabel(current.question.mode)}</span>
                    <span className="badge badge-default" style={{ opacity: 0.85 }}>
                      {current.question.suggestion_type}
                    </span>
                  </div>
                  <div style={{ fontSize: "14px", lineHeight: 1.55, color: "var(--text-1)" }}>
                    {current.question.text}
                  </div>
                  <div
                    style={{
                      marginTop: "18px",
                      fontSize: "11px",
                      color: "var(--text-4)",
                    }}
                  >
                    Tap to reveal answer
                  </div>
                </div>
                <div
                  className="drill-flip-face drill-flip-back"
                  style={{ textAlign: "left" }}
                >
                  <div
                    style={{
                      fontSize: "11px",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: "var(--text-4)",
                      marginBottom: "10px",
                    }}
                  >
                    Answer
                  </div>
                  <div
                    style={{
                      fontSize: "13px",
                      lineHeight: 1.6,
                      color: "var(--text-2)",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {current.question.answer}
                  </div>
                </div>
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "10px",
                maxWidth: 520,
                margin: "0 auto",
              }}
            >
              <button
                type="button"
                className="btn"
                disabled={!flipped || submitting}
                onClick={() => void submitQuality(1)}
                style={{
                  background: "var(--red-dim)",
                  border: "1px solid rgba(239,68,68,0.35)",
                  color: "var(--red)",
                  fontWeight: 600,
                  fontSize: "12px",
                  padding: "10px 8px",
                }}
              >
                Again
              </button>
              <button
                type="button"
                className="btn"
                disabled={!flipped || submitting}
                onClick={() => void submitQuality(3)}
                style={{
                  background: "var(--amber-dim)",
                  border: "1px solid rgba(245,158,11,0.35)",
                  color: "var(--amber)",
                  fontWeight: 600,
                  fontSize: "12px",
                  padding: "10px 8px",
                }}
              >
                Hard
              </button>
              <button
                type="button"
                className="btn"
                disabled={!flipped || submitting}
                onClick={() => void submitQuality(4)}
                style={{
                  background: "var(--green-dim)",
                  border: "1px solid rgba(34,197,94,0.35)",
                  color: "var(--green)",
                  fontWeight: 600,
                  fontSize: "12px",
                  padding: "10px 8px",
                }}
              >
                Good
              </button>
              <button
                type="button"
                className="btn"
                disabled={!flipped || submitting}
                onClick={() => void submitQuality(5)}
                style={{
                  background: "var(--blue-dim)",
                  border: "1px solid rgba(59,130,246,0.35)",
                  color: "var(--blue)",
                  fontWeight: 600,
                  fontSize: "12px",
                  padding: "10px 8px",
                }}
              >
                Easy
              </button>
            </div>

            {!flipped && (
              <p style={{ textAlign: "center", fontSize: "11px", color: "var(--text-4)", marginTop: "12px" }}>
                Flip the card to rate your recall
              </p>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
