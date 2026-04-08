import { MessageCircle, Zap, Check } from "lucide-react";
import type { VocalMetrics } from "../../lib/tauri";

type Props = {
  metrics: VocalMetrics | null;
  /** Seconds since last speech; only display silence chip when > 5. */
  liveSilenceSec: number;
};

function wpmDisplay(m: VocalMetrics) {
  const wpm = Math.round(m.words_per_minute);
  if (m.wpm_status === "ideal") {
    return (
      <span style={{ color: "var(--green)", display: "inline-flex", alignItems: "center", gap: 4 }}>
        {wpm} wpm
        <Check size={12} strokeWidth={2.5} aria-hidden />
      </span>
    );
  }
  if (m.wpm_status === "fast") {
    return (
      <span style={{ color: "var(--red)", display: "inline-flex", alignItems: "center", gap: 4 }}>
        {wpm} wpm
        <Zap size={12} aria-hidden />
        <span style={{ fontWeight: 500 }}>slow down</span>
      </span>
    );
  }
  return (
    <span style={{ color: "var(--amber)", fontWeight: 500 }}>
      {wpm} wpm — speed up
    </span>
  );
}

export default function VocalMetricsBar({ metrics, liveSilenceSec }: Props) {
  const filler = metrics?.filler_count_session ?? 0;
  const fillerWarn = filler > 5;

  return (
    <div
      className="vocal-metrics-bar"
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "14px 20px",
        padding: "8px 12px",
        marginBottom: "14px",
        borderRadius: "var(--r-md)",
        border: "1px solid var(--border-1)",
        background: "var(--bg-elevated)",
        fontSize: "12px",
        color: "var(--text-2)",
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <MessageCircle
          size={14}
          style={{ color: fillerWarn ? "var(--red)" : "var(--text-3)" }}
          aria-hidden
        />
        <span style={{ fontWeight: 600, color: fillerWarn ? "var(--red)" : "var(--text-1)" }}>
          Fillers: {filler}
        </span>
      </span>

      {metrics && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: "var(--text-4)", fontSize: "11px" }}>Pace</span>
          {wpmDisplay(metrics)}
        </span>
      )}

      {liveSilenceSec > 5 && (
        <span
          style={{
            marginLeft: "auto",
            fontVariantNumeric: "tabular-nums",
            color: "var(--amber)",
            fontWeight: 600,
          }}
          title="Silence since last speech"
        >
          🔇 {Math.floor(liveSilenceSec)}s
        </span>
      )}
    </div>
  );
}
