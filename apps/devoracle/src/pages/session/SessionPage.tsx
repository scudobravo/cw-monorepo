import { useEffect, useState, useRef, useMemo, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Mic,
  StopCircle,
  Code2,
  BrainCircuit,
  LayoutTemplate,
  PhoneCall,
  Activity,
  Sparkles,
  ArrowRight,
  X,
} from "lucide-react";
import { useSessionStore } from "../../stores/sessionStore";
import {
  onSuggestion,
  onTranscriptSegment,
  onSilenceDetected,
  openOverlay,
  closeOverlay,
  detectLeetcodeProblem,
  type SessionMode,
  type TranscriptSegment,
} from "../../lib/tauri";
import VocalMetricsBar from "../../components/session/VocalMetricsBar";
import { useOverlaySettingsStore } from "../../stores/overlaySettingsStore";
import { useAuthStore } from "../../stores/authStore";
import {
  fetchProblemByUrl,
  postSessionProblemContext,
  getCompanyBySlug,
} from "../../lib/api";
import AppShell from "../../components/layout/AppShell";

type ModeConfig = {
  label: string;
  desc: string;
  icon: ReactNode;
  color: string;
  mode: SessionMode;
};

const MODES: ModeConfig[] = [
  {
    label: "Coding Interview",
    desc: "Real-time hints & complexity analysis",
    icon: <Code2 size={16} />,
    color: "indigo",
    mode: { product: "DevOracle", mode: "coding_interview" },
  },
  {
    label: "Mock Interview",
    desc: "Behavioral & system design coaching",
    icon: <BrainCircuit size={16} />,
    color: "blue",
    mode: { product: "DevOracle", mode: "mock_interview" },
  },
  {
    label: "System Design",
    desc: "Architecture guidance on the fly",
    icon: <LayoutTemplate size={16} />,
    color: "amber",
    mode: { product: "DevOracle", mode: "system_design" },
  },
  {
    label: "Sales Call",
    desc: "Live objection handling & closing cues",
    icon: <PhoneCall size={16} />,
    color: "green",
    mode: { product: "RingWise", mode: "sales_call" },
  },
  {
    label: "Discovery",
    desc: "Pain-point mapping & MEDDIC guidance",
    icon: <Activity size={16} />,
    color: "blue",
    mode: { product: "RingWise", mode: "discovery" },
  },
];

function SessionTimer({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;

  return (
    <span className="session-timer">
      {h > 0 && `${String(h).padStart(2, "0")}:`}
      {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  );
}

function difficultyColor(d: string): string {
  const x = d.toLowerCase();
  if (x.includes("easy")) return "var(--green)";
  if (x.includes("hard")) return "var(--red)";
  if (x.includes("medium")) return "var(--amber)";
  return "var(--text-3)";
}

type LoadedProblem = { title: string; difficulty: string; markdown: string };

export default function SessionPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    session,
    suggestions,
    remoteSessionId,
    isLoading,
    error,
    startSession,
    stopSession,
    addSuggestion,
    applyTranscriptSegment,
    vocalMetrics,
    targetCompany,
  } = useSessionStore();

  const [prepCompanyName, setPrepCompanyName] = useState<string | null>(null);

  const [startTime] = useState(() => Date.now());
  const [transcriptLines, setTranscriptLines] = useState<
    { id: string; text: string; speaker: "user" | "other" }[]
  >([]);
  const [loadedProblem, setLoadedProblem] = useState<LoadedProblem | null>(null);
  const [problemIgnored, setProblemIgnored] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const lastSpeechAt = useRef<number>(Date.now());
  const [silenceClock, setSilenceClock] = useState(0);
  const [silenceHint, setSilenceHint] = useState<string | null>(null);

  // Auto-start if navigated with a mode
  useEffect(() => {
    const locationMode = (location.state as { mode?: SessionMode } | null)?.mode;
    if (locationMode && !session && !isLoading) {
      startSession(locationMode);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!session) return;
    const isCw = session.mode?.product === "DevOracle";
    if (!isCw) return;
    const { showDuringSessions } = useOverlaySettingsStore.getState();
    if (showDuringSessions) {
      void openOverlay().catch(() => {});
    }
    return () => {
      void closeOverlay().catch(() => {});
    };
  }, [session?.id]);

  useEffect(() => {
    if (!targetCompany) {
      setPrepCompanyName(null);
      return;
    }
    const t = useAuthStore.getState().token();
    if (!t) {
      setPrepCompanyName(targetCompany);
      return;
    }
    getCompanyBySlug(t, targetCompany)
      .then((c) => setPrepCompanyName(c.name))
      .catch(() => setPrepCompanyName(targetCompany));
  }, [targetCompany]);

  useEffect(() => {
    if (session?.id) lastSpeechAt.current = Date.now();
  }, [session?.id]);

  useEffect(() => {
    if (!session || session.mode?.product !== "DevOracle") return;
    const id = window.setInterval(() => setSilenceClock((c) => c + 1), 500);
    return () => clearInterval(id);
  }, [session?.id, session?.mode?.product]);

  const liveSilenceSec = useMemo(() => {
    void silenceClock;
    if (transcriptLines.length === 0) return 0;
    return (Date.now() - lastSpeechAt.current) / 1000;
  }, [transcriptLines.length, silenceClock]);

  useEffect(() => {
    let unlistenS: (() => void) | null = null;
    let unlistenT: (() => void) | null = null;
    let unlistenSl: (() => void) | null = null;
    onSuggestion((s) => addSuggestion(s)).then((fn) => {
      unlistenS = fn;
    });
    onTranscriptSegment((seg: TranscriptSegment) => {
      lastSpeechAt.current = Date.now();
      setSilenceHint(null);
      applyTranscriptSegment(seg);
      setTranscriptLines((prev) => [
        ...prev,
        {
          id: seg.id,
          text: seg.text,
          speaker: seg.speaker,
        },
      ]);
    }).then((fn) => {
      unlistenT = fn;
    });
    onSilenceDetected((p) => {
      setSilenceHint(p.suggested_action);
    }).then((fn) => {
      unlistenSl = fn;
    });
    return () => {
      unlistenS?.();
      unlistenT?.();
      unlistenSl?.();
    };
  }, [addSuggestion, applyTranscriptSegment]);

  useEffect(() => {
    if (
      !session ||
      session.mode?.product !== "DevOracle" ||
      !remoteSessionId ||
      problemIgnored ||
      loadedProblem
    ) {
      return;
    }

    const tick = async () => {
      try {
        const url = await detectLeetcodeProblem();
        if (!url?.trim()) return;
        const token = useAuthStore.getState().token();
        if (!token) return;
        const p = await fetchProblemByUrl(token, url);
        await postSessionProblemContext(token, remoteSessionId, {
          title: p.title,
          difficulty: p.difficulty,
          markdown: p.markdown,
        });
        setLoadedProblem({
          title: p.title,
          difficulty: p.difficulty,
          markdown: p.markdown,
        });
      } catch {
        /* ignore */
      }
    };

    const id = window.setInterval(() => void tick(), 3000);
    void tick();
    return () => window.clearInterval(id);
  }, [session?.id, remoteSessionId, problemIgnored, loadedProblem, session]);

  useEffect(() => {
    if (suggestionsRef.current) {
      suggestionsRef.current.scrollTop = suggestionsRef.current.scrollHeight;
    }
  }, [suggestions]);

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcriptLines]);

  const activeModeConfig = session
    ? MODES.find(
        (m) =>
          m.mode.product === session.mode?.product &&
          m.mode.mode === session.mode?.mode,
      )
    : null;

  const isDevOracle = session?.mode?.product === "DevOracle";

  async function handleEndSession() {
    const snap = useSessionStore.getState();
    const transcript_segments = transcriptLines.map((l) => ({
      text: l.text,
      speaker: l.speaker,
    }));
    const suggestionsPayload = snap.suggestions.map((s) => ({
      suggestion_type: s.suggestion_type,
      content: s.content,
    }));
    const modeStr =
      snap.session?.mode?.product === "DevOracle"
        ? snap.session.mode.mode
        : snap.session?.mode?.mode ?? "";
    const sid = snap.remoteSessionId ?? snap.session?.id;
    const isCw = snap.session?.mode?.product === "DevOracle";
    const hints_used = snap.suggestions.filter((s) =>
      /hint|complexity|approach/i.test(s.suggestion_type),
    ).length;

    await stopSession();

    if (isCw && sid) {
      navigate(`/session-summary/${sid}`, {
        state: {
          transcript_segments,
          suggestions: suggestionsPayload,
          mode: modeStr,
          talk_ratio_user: snap.talkRatio.ratio,
          hints_used,
        },
      });
    } else {
      navigate("/");
    }
  }

  return (
    <AppShell>
      <div className="page fade-in">
        <div className="page-header">
          <div>
            <h1 className="page-title">Session</h1>
            <p className="page-subtitle">
              {session
                ? `${activeModeConfig?.label ?? "Active"} · ${session.mode?.product ?? ""}`
                : "Select a mode to begin"}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {session && loadedProblem && !problemIgnored && (
              <span
                className="badge badge-accent"
                style={{ fontSize: "11px", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                title={`${loadedProblem.title} (${loadedProblem.difficulty})`}
              >
                Problem: {loadedProblem.title}
              </span>
            )}
            {session && (
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => void handleEndSession()}
                disabled={isLoading}
              >
                <StopCircle size={14} />
                End session
              </button>
            )}
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

        {session && loadedProblem && !problemIgnored && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              padding: "10px 14px",
              marginBottom: "14px",
              borderRadius: "var(--r-md)",
              background: "rgba(99, 102, 241, 0.1)",
              border: "1px solid rgba(99, 102, 241, 0.25)",
              fontSize: "13px",
              color: "var(--text-1)",
            }}
          >
            <span>
              📋 Problem loaded:{" "}
              <strong>{loadedProblem.title}</strong>{" "}
              <span style={{ color: difficultyColor(loadedProblem.difficulty) }}>
                ({loadedProblem.difficulty})
              </span>
            </span>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: "4px 8px" }}
              onClick={() => {
                setProblemIgnored(true);
                setLoadedProblem(null);
              }}
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {session ? (
          <>
            <div className="session-header">
              <div className="session-info">
                <span className="dot dot-green dot-pulse" />
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--green)",
                  }}
                >
                  Live
                </span>
                {activeModeConfig && (
                  <>
                    <span style={{ color: "var(--border-2)", margin: "0 6px" }}>
                      ·
                    </span>
                    <span
                      className={`badge badge-${activeModeConfig.color === "indigo" ? "accent" : activeModeConfig.color === "green" ? "green" : activeModeConfig.color === "amber" ? "amber" : "default"}`}
                    >
                      {activeModeConfig.label}
                    </span>
                  </>
                )}
                {isDevOracle && prepCompanyName && (
                  <>
                    <span style={{ color: "var(--border-2)", margin: "0 6px" }}>
                      ·
                    </span>
                    <span
                      className="badge badge-accent"
                      title="Company-specific interview prep"
                    >
                      {prepCompanyName} prep mode
                    </span>
                  </>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <SessionTimer startTime={startTime} />
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "var(--r-md)",
                    background: "var(--green-dim)",
                    border: "1px solid rgba(34,197,94,0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--green)",
                  }}
                >
                  <Mic size={13} />
                </div>
              </div>
            </div>

            {isDevOracle && (
              <VocalMetricsBar metrics={vocalMetrics} liveSilenceSec={liveSilenceSec} />
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 380px)",
                gap: "20px",
                alignItems: "start",
              }}
            >
              <div style={{ minWidth: 0 }}>
                {isDevOracle && loadedProblem && !problemIgnored && (
                  <div className="section">
                    <div className="section-header">
                      <span className="section-title">Active problem</span>
                      <span
                        className="badge badge-default"
                        style={{ color: difficultyColor(loadedProblem.difficulty) }}
                      >
                        {loadedProblem.difficulty}
                      </span>
                    </div>
                    <div
                      className="card"
                      style={{
                        maxHeight: "160px",
                        overflowY: "auto",
                        fontSize: "12px",
                        lineHeight: 1.5,
                        color: "var(--text-2)",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {loadedProblem.markdown.slice(0, 4000)}
                    </div>
                  </div>
                )}

                <div className="section">
                  <div className="section-header">
                    <span className="section-title">Live transcript</span>
                    <span className="badge badge-default">{transcriptLines.length}</span>
                  </div>
                  <div
                    className="card"
                    style={{ maxHeight: "220px", overflowY: "auto" }}
                    ref={transcriptRef}
                  >
                    {transcriptLines.length === 0 ? (
                      <div className="empty-state" style={{ padding: "20px" }}>
                        <div className="empty-desc">Waiting for speech…</div>
                      </div>
                    ) : (
                      transcriptLines.map((line) => (
                        <div
                          key={line.id}
                          className="suggestion-item"
                          style={{ fontSize: "12px", marginBottom: "6px" }}
                        >
                          <span
                            style={{
                              fontSize: "10px",
                              color: "var(--text-4)",
                              marginRight: "8px",
                            }}
                          >
                            {line.speaker === "user" ? "You" : "Other"}
                          </span>
                          {line.text}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="section" style={{ marginTop: 0 }}>
                <div className="section-header">
                  <div
                    style={{ display: "flex", alignItems: "center", gap: "6px" }}
                  >
                    <Sparkles size={13} style={{ color: "var(--accent-light)" }} />
                    <span className="section-title">AI Suggestions</span>
                  </div>
                  <span className="badge badge-default">{suggestions.length}</span>
                </div>

                <div
                  style={{
                    position: "relative",
                    minHeight: "140px",
                  }}
                >
                  <div
                    aria-hidden={!silenceHint}
                    style={{
                      position: "absolute",
                      inset: 0,
                      zIndex: 2,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "16px",
                      borderRadius: "var(--r-md)",
                      background: "rgba(15, 23, 42, 0.72)",
                      border: "1px solid rgba(99, 102, 241, 0.35)",
                      pointerEvents: "none",
                      opacity: silenceHint ? 1 : 0,
                      transition: "opacity 0.35s ease",
                    }}
                  >
                    {silenceHint && (
                      <span
                        style={{
                          fontSize: "13px",
                          fontWeight: 600,
                          color: "var(--text-1)",
                          textAlign: "center",
                          lineHeight: 1.45,
                        }}
                      >
                        💬 {silenceHint}
                      </span>
                    )}
                  </div>

                  {suggestions.length === 0 ? (
                    <div className="card">
                      <div className="empty-state" style={{ padding: "36px 24px" }}>
                        <div className="empty-icon">
                          <Sparkles size={18} />
                        </div>
                        <div className="empty-title">Listening…</div>
                        <div className="empty-desc">
                          AI suggestions will appear here as the conversation
                          progresses.
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      ref={suggestionsRef}
                      style={{ maxHeight: "520px", overflowY: "auto" }}
                    >
                      {suggestions.map((s, i) => (
                        <div
                          key={s.id}
                          className={`suggestion-item fade-in${i === suggestions.length - 1 ? " suggestion-item-latest" : ""}`}
                        >
                          {s.content}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div>
            <div className="section">
              <div className="section-header">
                <span className="section-title">DevOracle — Interview AI</span>
              </div>
              <div className="card-grid-3">
                {MODES.filter((m) => m.mode.product === "DevOracle").map(
                  ({ label, desc, icon, color, mode }) => (
                    <div
                      key={label}
                      className="card card-interactive mode-card"
                      onClick={() => !isLoading && startSession(mode)}
                      style={{ opacity: isLoading ? 0.5 : 1 }}
                    >
                      <div className={`mode-card-icon ${color}`}>{icon}</div>
                      <div>
                        <div className="mode-card-title">{label}</div>
                        <div className="mode-card-desc mt-1">{desc}</div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "flex-end",
                          marginTop: "auto",
                        }}
                      >
                        <ArrowRight
                          size={13}
                          style={{ color: "var(--text-3)" }}
                        />
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>

            <div className="section">
              <div className="section-header">
                <span className="section-title">RingWise — Sales AI</span>
              </div>
              <div className="card-grid-3">
                {MODES.filter((m) => m.mode.product === "RingWise").map(
                  ({ label, desc, icon, color, mode }) => (
                    <div
                      key={label}
                      className="card card-interactive mode-card"
                      onClick={() => !isLoading && startSession(mode)}
                      style={{ opacity: isLoading ? 0.5 : 1 }}
                    >
                      <div className={`mode-card-icon ${color}`}>{icon}</div>
                      <div>
                        <div className="mode-card-title">{label}</div>
                        <div className="mode-card-desc mt-1">{desc}</div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "flex-end",
                          marginTop: "auto",
                        }}
                      >
                        <ArrowRight
                          size={13}
                          style={{ color: "var(--text-3)" }}
                        />
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
