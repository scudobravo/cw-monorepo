import { useEffect, useState } from "react";
import { X, Copy, Check } from "lucide-react";
import type { CompetitorCard as CompetitorCardData } from "../lib/tauri";

const DISMISS_MS = 120_000;

type Props = {
  card: CompetitorCardData;
  onClose: () => void;
};

export default function CompetitorCard({ card, onClose }: Props) {
  const [visible, setVisible] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(onClose, DISMISS_MS);
    return () => window.clearTimeout(t);
  }, [card.id, onClose]);

  async function copyQuestion(q: string, idx: number) {
    try {
      await navigator.clipboard.writeText(q);
      setCopiedIdx(idx);
      window.setTimeout(() => setCopiedIdx(null), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        zIndex: 50,
        width: "min(380px, calc(100vw - 48px))",
        transform: visible ? "translateX(0)" : "translateX(110%)",
        opacity: visible ? 1 : 0,
        transition: "transform 300ms ease, opacity 300ms ease",
        pointerEvents: "auto",
      }}
    >
      <div
        className="card"
        style={{
          padding: 0,
          overflow: "hidden",
          borderColor: "rgba(239, 68, 68, 0.35)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 8,
            padding: "12px 14px",
            borderBottom: "1px solid var(--border-1)",
            background: "rgba(239, 68, 68, 0.08)",
          }}
        >
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#f87171", letterSpacing: "0.04em" }}>
              Competitor detected
            </div>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-1)", marginTop: 4 }}>
              {card.name}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            title="Chiudi"
            style={{ padding: "6px 8px", minWidth: "auto" }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
          <section>
            <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--accent-light)", marginBottom: 6, textTransform: "uppercase" }}>
              Where we win
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, color: "var(--text-2)", fontSize: "12px", lineHeight: 1.55 }}>
              {(card.win_points ?? []).map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </section>

          <section>
            <div style={{ fontSize: "10px", fontWeight: 700, color: "#f87171", marginBottom: 6, textTransform: "uppercase" }}>
              Watch out
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, color: "var(--text-2)", fontSize: "12px", lineHeight: 1.55 }}>
              {(card.lose_points ?? []).map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </section>

          <section>
            <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-4)", marginBottom: 6, textTransform: "uppercase" }}>
              Positioning
            </div>
            <p style={{ margin: 0, fontSize: "12px", fontStyle: "italic", color: "var(--text-2)", lineHeight: 1.55 }}>
              {card.positioning}
            </p>
          </section>

          <section>
            <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-4)", marginBottom: 6, textTransform: "uppercase" }}>
              Trap questions
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(card.trap_questions ?? []).slice(0, 3).map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => void copyQuestion(q, idx)}
                  className="btn btn-secondary"
                  style={{
                    textAlign: "left",
                    justifyContent: "flex-start",
                    fontSize: "11px",
                    lineHeight: 1.45,
                    whiteSpace: "normal",
                    gap: 8,
                  }}
                >
                  {copiedIdx === idx ? (
                    <Check size={14} style={{ color: "var(--accent-light)", flexShrink: 0 }} />
                  ) : (
                    <Copy size={14} style={{ flexShrink: 0 }} />
                  )}
                  <span>{q}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
