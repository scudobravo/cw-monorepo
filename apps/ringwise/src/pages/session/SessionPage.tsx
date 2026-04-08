import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Square,
  Mic,
  MicOff,
  Clock,
  MessageSquare,
  TrendingUp,
  Lightbulb,
  ChevronDown,
  Target,
} from "lucide-react";
import AppShell from "../../components/layout/AppShell";
import TalkRatioPill from "../../components/TalkRatioPill";
import CompetitorCard from "../../components/CompetitorCard";
import { useSessionStore } from "../../stores/sessionStore";
import {
  onSuggestion,
  onTranscriptSegment,
  onCompetitorDetected,
  type CompetitorCard as CompetitorCardData,
  type Suggestion,
  type TranscriptSegment,
} from "../../lib/tauri";

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function modeLabel(mode: unknown): string {
  const m = (mode as { mode?: string })?.mode ?? "";
  return {
    sales_call:  "Sales Call",
    discovery:   "Discovery",
    demo:        "Demo",
    negotiation: "Negotiation",
    follow_up:   "Follow-up",
  }[m] ?? m;
}

interface TranscriptLine {
  id: string;
  speaker: "you" | "prospect";
  text: string;
  ts: number;
}

function isBuyingCue(s: Suggestion): boolean {
  return s.suggestion_type === "closing_move" && s.priority === "high";
}

export default function SessionPage() {
  const navigate = useNavigate();
  const {
    session,
    stopSession,
    isLoading,
    addSuggestion,
    suggestions,
    talkRatio,
    applyTranscriptSegment,
  } = useSessionStore();

  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [competitorCard, setCompetitorCard] = useState<CompetitorCardData | null>(null);
  const dismissCompetitor = useCallback(() => setCompetitorCard(null), []);

  // Redirect if no session
  useEffect(() => {
    if (!session) navigate("/", { replace: true });
  }, [session, navigate]);

  // Timer
  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Listen for AI suggestions and live transcript
  useEffect(() => {
    let unlistenS: (() => void) | null = null;
    let unlistenT: (() => void) | null = null;
    onSuggestion((s: Suggestion) => addSuggestion(s)).then((fn) => {
      unlistenS = fn;
    });
    onTranscriptSegment((seg: TranscriptSegment) => {
      applyTranscriptSegment(seg);
      setTranscript((t) => [
        ...t,
        {
          id: seg.id,
          speaker: seg.speaker === "user" ? "you" : "prospect",
          text: seg.text,
          ts: Date.parse(seg.timestamp) || Date.now(),
        },
      ]);
    }).then((fn) => {
      unlistenT = fn;
    });
    return () => {
      unlistenS?.();
      unlistenT?.();
    };
  }, [addSuggestion, applyTranscriptSegment]);

  useEffect(() => {
    let unlistenC: (() => void) | null = null;
    onCompetitorDetected((c) => setCompetitorCard(c)).then((fn) => {
      unlistenC = fn;
    });
    return () => {
      unlistenC?.();
    };
  }, []);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcript]);

  const handleStop = async () => {
    if (!session) return;
    if (timerRef.current) clearInterval(timerRef.current);
    const store = useSessionStore.getState();
    const backendSessionId = store.remoteSessionId ?? session?.id;
    const transcriptPayload = transcript.map((line) => ({
      text: line.text,
      speaker: line.speaker === "you" ? "user" : "other",
      timestamp: new Date(line.ts).toISOString(),
    }));
    const suggestionsPayload = store.suggestions.map((s) => ({
      suggestion_type: s.suggestion_type,
      content: s.content,
    }));
    const talkRatioUser = store.talkRatio.ratio;
    const modeStr =
      session?.mode.product === "RingWise" ? session.mode.mode : "sales_call";
    const startedAt = session?.started_at ?? "";

    await stopSession();

    if (backendSessionId) {
      navigate(`/session-summary/${backendSessionId}`, {
        replace: true,
        state: {
          transcript_segments: transcriptPayload,
          suggestions: suggestionsPayload,
          talk_ratio_user: talkRatioUser,
          mode: modeStr,
          duration_secs: elapsed,
          started_at: startedAt,
        },
      });
    } else {
      navigate("/history", { replace: true });
    }
  };

  if (!session) return null;

  const callMode =
    session.mode.product === "RingWise"
      ? session.mode.mode
      : "sales_call";

  const buyingSignalsCount = useMemo(
    () => suggestions.filter(isBuyingCue).length,
    [suggestions],
  );

  const sortedSuggestions = useMemo(() => {
    const score = (s: Suggestion) => (isBuyingCue(s) ? 1 : 0);
    return [...suggestions].sort((a, b) => {
      const d = score(b) - score(a);
      if (d !== 0) return d;
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });
  }, [suggestions]);

  return (
    <AppShell>
      <div className="page-container fade-in" style={{ position: "relative" }}>
        {competitorCard ? (
          <CompetitorCard card={competitorCard} onClose={dismissCompetitor} />
        ) : null}
        {/* Header */}
        <div className="page-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span className="dot dot-green dot-pulse" />
            <div>
              <h1 className="page-title">{modeLabel(session.mode)}</h1>
              <p className="page-subtitle">AI coaching active</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              className={`btn btn-secondary`}
              onClick={() => setMuted((m) => !m)}
              title={muted ? "Unmute" : "Mute mic"}
            >
              {muted ? <MicOff size={14} /> : <Mic size={14} />}
              {muted ? "Unmuted" : "Muted"}
            </button>
            <button
              className="btn btn-danger"
              onClick={handleStop}
              disabled={isLoading}
            >
              <Square size={14} />
              End call
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: "8px",
            marginBottom: "16px",
          }}
        >
          {[
            { icon: <Clock size={13} />, label: "Duration", value: formatDuration(elapsed) },
            { icon: <TrendingUp size={13} />, label: "Talk ratio", value: null as string | null },
            {
              icon: <MessageSquare size={13} />,
              label: "Cues received",
              value: String(suggestions.length),
            },
            {
              icon: <Target size={13} />,
              label: "Buying signals",
              value: String(buyingSignalsCount),
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="card"
              style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: "8px" }}
            >
              <div
                style={{
                  width: 26,
                  height: 26,
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
                {stat.icon}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: "10px", color: "var(--text-4)" }}>{stat.label}</div>
                {stat.value !== null ? (
                  <div
                    style={{
                      fontSize: "16px",
                      fontWeight: 700,
                      color: "var(--text-1)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {stat.value}
                  </div>
                ) : (
                  <TalkRatioPill ratioUser={talkRatio.ratio} mode={callMode} />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Two-panel layout */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          {/* Live transcript */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div className="section-label">Live transcript</div>
            <div
              className="card"
              ref={transcriptRef}
              style={{
                height: "340px",
                overflowY: "auto",
                padding: "12px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              {transcript.length === 0 ? (
                <div style={{ color: "var(--text-4)", fontSize: "12px", textAlign: "center", marginTop: "40px" }}>
                  Transcript will appear here…
                </div>
              ) : (
                transcript.map((line) => (
                  <div
                    key={line.id}
                    style={{
                      display: "flex",
                      gap: "8px",
                      alignItems: "flex-start",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        color: line.speaker === "you" ? "var(--accent-light)" : "var(--text-3)",
                        minWidth: "60px",
                        paddingTop: "1px",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      {line.speaker === "you" ? "You" : "Prospect"}
                    </span>
                    <span style={{ fontSize: "12px", color: "var(--text-2)", lineHeight: 1.6 }}>
                      {line.text}
                    </span>
                  </div>
                ))
              )}
              <ChevronDown size={12} style={{ color: "var(--text-4)", margin: "0 auto" }} />
            </div>
          </div>

          {/* AI Cues */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div className="section-label">AI cues</div>
            <div
              className="card"
              style={{
                height: "340px",
                overflowY: "auto",
                padding: "12px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              {suggestions.length === 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "8px",
                    marginTop: "40px",
                    color: "var(--text-4)",
                    fontSize: "12px",
                  }}
                >
                  <Lightbulb size={22} style={{ opacity: 0.3 }} />
                  <span>Cues will appear as the call progresses</span>
                </div>
              ) : (
                sortedSuggestions.map((s) => {
                  const buying = isBuyingCue(s);
                  return (
                    <div
                      key={s.id}
                      className={buying ? "fade-in cue-buying-pulse" : "fade-in"}
                      style={{
                        padding: "10px 12px",
                        background: buying ? "rgba(16, 185, 129, 0.1)" : "var(--accent-dim)",
                        border: buying
                          ? "2px solid var(--accent)"
                          : "1px solid var(--accent-border)",
                        borderRadius: "var(--r-md)",
                      }}
                    >
                      {buying ? (
                        <div
                          style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            color: "var(--accent-light)",
                            marginBottom: "6px",
                            letterSpacing: "0.02em",
                          }}
                        >
                          🎯 Buying signal
                          {s.buying_signal_type ? (
                            <span style={{ opacity: 0.85, fontWeight: 500 }}>
                              {" "}
                              · {s.buying_signal_type}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                      <div
                        style={{
                          fontSize: "10px",
                          fontWeight: 600,
                          color: "var(--accent-light)",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                          marginBottom: "4px",
                        }}
                      >
                        {s.suggestion_type}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-2)", lineHeight: 1.6 }}>
                        {s.content}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
