import type { CSSProperties } from "react";
import type { CallMode } from "../lib/tauri";

export type RingwiseMode = CallMode;

const TARGETS: Record<
  RingwiseMode,
  { title: string; min: number; max: number; note?: string }
> = {
  sales_call: { title: "Sales call", min: 40, max: 50 },
  discovery: { title: "Discovery", min: 30, max: 45, note: "listen more" },
  demo: { title: "Demo", min: 55, max: 65, note: "you lead" },
  negotiation: { title: "Negotiation", min: 40, max: 50 },
  follow_up: { title: "Follow-up", min: 50, max: 60 },
};

function pillVariant(ratio: number): "green" | "amber" | "red" | "neutral" {
  if (ratio > 75) return "red";
  if (ratio > 60 || ratio < 30) return "amber";
  if (ratio >= 30 && ratio <= 50) return "green";
  return "neutral";
}

const variantStyle: Record<
  "green" | "amber" | "red" | "neutral",
  CSSProperties
> = {
  green: {
    background: "var(--accent-dim)",
    borderColor: "var(--accent-border)",
    color: "var(--accent-light)",
  },
  amber: {
    background: "rgba(245, 158, 11, 0.1)",
    borderColor: "rgba(245, 158, 11, 0.35)",
    color: "#fbbf24",
  },
  red: {
    background: "rgba(239, 68, 68, 0.1)",
    borderColor: "rgba(239, 68, 68, 0.38)",
    color: "#f87171",
  },
  neutral: {
    background: "var(--bg-elevated)",
    borderColor: "var(--border-1)",
    color: "var(--text-2)",
  },
};

export interface TalkRatioPillProps {
  /** Percentuale parole utente (0–100) */
  ratioUser: number;
  mode: RingwiseMode;
}

export default function TalkRatioPill({ ratioUser, mode }: TalkRatioPillProps) {
  const u = Math.max(0, Math.min(100, Math.round(ratioUser)));
  const prospect = Math.max(0, Math.min(100, 100 - u));
  const v = pillVariant(ratioUser);
  const t = TARGETS[mode];
  const note = t.note ? ` — ${t.note}` : "";
  const tooltip = [
    `${t.title}: target ${t.min}%–${t.max}%${note}`,
    `Current split: You ${u}% · Prospect ${prospect}%`,
  ].join("\n");

  return (
    <div
      title={tooltip}
      className="talk-ratio-pill"
      style={{
        ...variantStyle[v],
        border: "1px solid",
        borderRadius: "var(--r-md)",
        padding: "6px 12px",
        fontSize: "13px",
        fontWeight: 600,
        fontVariantNumeric: "tabular-nums",
        transition:
          "background 0.35s ease, border-color 0.35s ease, color 0.35s ease, box-shadow 0.35s ease",
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        cursor: "default",
        maxWidth: "100%",
      }}
    >
      <span>You {u}%</span>
      <span style={{ opacity: 0.45 }}>·</span>
      <span>Prospect {prospect}%</span>
    </div>
  );
}
