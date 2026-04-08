import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Code2, X } from "lucide-react";
import { onSuggestion, type Suggestion } from "../../lib/tauri";
import { useOverlaySettingsStore } from "../../stores/overlaySettingsStore";

const MAX_VISIBLE = 5;

export default function OverlayPage() {
  const opacity = useOverlaySettingsStore((s) => s.opacity);
  const [items, setItems] = useState<Suggestion[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("savant_overlay_settings");
      if (raw) {
        const p = JSON.parse(raw) as { opacity?: number; showDuringSessions?: boolean };
        useOverlaySettingsStore.setState({
          opacity:
            typeof p.opacity === "number"
              ? Math.min(1, Math.max(0.5, p.opacity))
              : 1,
          showDuringSessions: p.showDuringSessions !== false,
        });
      }
    } catch {
      /* ignore */
    }
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    document.body.style.margin = "0";
    return () => {
      document.documentElement.style.background = "";
      document.body.style.background = "";
      document.body.style.margin = "";
    };
  }, []);

  useEffect(() => {
    const readOpacity = () => {
      try {
        const raw = localStorage.getItem("savant_overlay_settings");
        if (!raw) return;
        const p = JSON.parse(raw) as { opacity?: number };
        if (typeof p.opacity === "number") {
          useOverlaySettingsStore.setState({
            opacity: Math.min(1, Math.max(0.5, p.opacity)),
          });
        }
      } catch {
        /* ignore */
      }
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === "savant_overlay_settings") readOpacity();
    };
    window.addEventListener("storage", onStorage);
    const bc =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel("savant-overlay")
        : null;
    bc?.addEventListener("message", (ev: MessageEvent) => {
      if (typeof ev.data?.opacity === "number") {
        useOverlaySettingsStore.setState({
          opacity: Math.min(1, Math.max(0.5, ev.data.opacity)),
        });
      }
    });
    return () => {
      window.removeEventListener("storage", onStorage);
      bc?.close();
    };
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    onSuggestion((s) => {
      setItems((prev) => {
        const next = [...prev, s];
        if (next.length > 32) return next.slice(-32);
        return next;
      });
    }).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, []);

  const visible = items.slice(-MAX_VISIBLE);

  async function handleClose() {
    try {
      await invoke("close_overlay");
    } catch {
      /* ignore */
    }
  }

  const shellBg = `rgba(10, 10, 20, ${0.88 * opacity})`;

  return (
    <div
      style={{
        minHeight: "100vh",
        boxSizing: "border-box",
        padding: "10px",
        background: "transparent",
      }}
    >
      <div
        style={{
          borderRadius: "12px",
          border: "1px solid rgba(99, 102, 241, 0.3)",
          background: shellBg,
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: "calc(100vh - 20px)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 10px",
            borderBottom: "1px solid rgba(99, 102, 241, 0.2)",
            flexShrink: 0,
          }}
        >
          <div
            data-tauri-drag-region
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flex: 1,
              minWidth: 0,
              cursor: "default",
            }}
          >
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: "6px",
                background: "rgba(99, 102, 241, 0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#a5b4fc",
                flexShrink: 0,
              }}
            >
              <Code2 size={14} strokeWidth={2.2} />
            </div>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "rgba(255,255,255,0.92)",
                letterSpacing: "0.02em",
              }}
            >
              DevOracle
            </span>
          </div>
          <button
            type="button"
            onClick={() => void handleClose()}
            style={{
              border: "none",
              background: "rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.85)",
              borderRadius: "6px",
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
            }}
            aria-label="Close overlay"
          >
            <X size={14} />
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "8px 10px 10px",
            maxHeight: "min(420px, calc(100vh - 120px))",
          }}
        >
          {visible.length === 0 ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                color: "rgba(255,255,255,0.55)",
                fontSize: "12px",
                padding: "12px 4px",
              }}
            >
              <span className="dot dot-accent dot-pulse" />
              Listening…
            </div>
          ) : (
            visible.map((s) => (
              <div
                key={s.id}
                style={{
                  marginBottom: "8px",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  background: "rgba(0,0,0,0.25)",
                  border: "1px solid rgba(99, 102, 241, 0.15)",
                }}
              >
                <div style={{ marginBottom: "6px" }}>
                  <span
                    style={{
                      display: "inline-block",
                      fontSize: "10px",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      padding: "2px 8px",
                      borderRadius: "999px",
                      background: "rgba(79, 70, 229, 0.45)",
                      color: "rgba(255,255,255,0.95)",
                    }}
                  >
                    {s.suggestion_type || "hint"}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    lineHeight: 1.45,
                    color: "#fff",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {s.content}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
