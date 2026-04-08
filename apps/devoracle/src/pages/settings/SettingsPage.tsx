import { useEffect } from "react";
import { EyeOff, Keyboard, Monitor, Layers } from "lucide-react";
import { useStealthStore } from "../../stores/stealthStore";
import { useOverlaySettingsStore } from "../../stores/overlaySettingsStore";
import { openOverlay } from "../../lib/tauri";
import type { StealthConfig, StealthOutputChannel } from "../../lib/tauri";
import AppShell from "../../components/layout/AppShell";

const CHANNELS: { label: string; desc: string; value: StealthOutputChannel }[] = [
  {
    label: "Overlay (hotkey)",
    desc: "Transparent floating window, toggled with hotkey",
    value: "overlay",
  },
  {
    label: "Second Screen",
    desc: "Suggestions displayed on a secondary monitor",
    value: "second_screen",
  },
  {
    label: "Haptic Feedback",
    desc: "Vibration patterns on supported devices",
    value: "haptic",
  },
  {
    label: "System Tray",
    desc: "Minimal tray popover, always available",
    value: "system_tray",
  },
];

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="toggle-track" />
    </label>
  );
}

export default function SettingsPage() {
  const { config, isLoading, loadConfig, updateConfig } = useStealthStore();
  const overlayEnabled = useOverlaySettingsStore((s) => s.showDuringSessions);
  const overlayOpacity = useOverlaySettingsStore((s) => s.opacity);
  const setOverlayEnabled = useOverlaySettingsStore((s) => s.setShowDuringSessions);
  const setOverlayOpacity = useOverlaySettingsStore((s) => s.setOpacity);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  if (isLoading || !config) {
    return (
      <AppShell>
        <div className="page">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "var(--text-3)",
              fontSize: "13px",
              marginTop: "48px",
            }}
          >
            <span className="dot dot-accent dot-pulse" />
            Loading settings…
          </div>
        </div>
      </AppShell>
    );
  }

  const update = (partial: Partial<StealthConfig>) =>
    updateConfig({ ...config, ...partial });

  return (
    <AppShell>
      <div className="page fade-in">
        <div className="page-header">
          <div>
            <h1 className="page-title">Settings</h1>
            <p className="page-subtitle">Configure stealth and behavior</p>
          </div>
        </div>

        {/* Stealth section */}
        <div className="section">
          <div className="section-header">
            <span className="section-title">
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <EyeOff size={11} />
                Stealth Mode
              </span>
            </span>
          </div>

          <div className="card" style={{ padding: "0 16px" }}>
            <div className="toggle-row">
              <div className="toggle-info">
                <span className="toggle-label">Auto-hide during calls</span>
                <span className="toggle-desc">
                  Automatically activates stealth when a call app is detected
                </span>
              </div>
              <Toggle
                checked={config.auto_hide_during_calls}
                onChange={(v) => update({ auto_hide_during_calls: v })}
              />
            </div>

            <div className="toggle-row">
              <div className="toggle-info">
                <span className="toggle-label">Exclude from screen capture</span>
                <span className="toggle-desc">
                  Window is hidden from screen recording and screenshots
                </span>
              </div>
              <Toggle
                checked={config.exclude_from_screen_capture}
                onChange={(v) => update({ exclude_from_screen_capture: v })}
              />
            </div>
          </div>
        </div>

        {/* Output channel */}
        <div className="section">
          <div className="section-header">
            <span className="section-title">
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <Monitor size={11} />
                Output Channel
              </span>
            </span>
          </div>

          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {CHANNELS.map((ch, i) => {
              const active = config.output_channel === ch.value;
              return (
                <div
                  key={ch.value}
                  onClick={() => update({ output_channel: ch.value })}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    cursor: "pointer",
                    borderBottom:
                      i < CHANNELS.length - 1
                        ? "1px solid var(--border-1)"
                        : undefined,
                    background: active ? "var(--accent-dim)" : "transparent",
                    transition: "background var(--t-fast)",
                  }}
                  onMouseEnter={(e) => {
                    if (!active)
                      (e.currentTarget as HTMLElement).style.background =
                        "var(--bg-hover)";
                  }}
                  onMouseLeave={(e) => {
                    if (!active)
                      (e.currentTarget as HTMLElement).style.background =
                        "transparent";
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 500,
                        color: active ? "var(--accent-light)" : "var(--text-1)",
                      }}
                    >
                      {ch.label}
                    </div>
                    <div
                      style={{ fontSize: "11px", color: "var(--text-3)", marginTop: "2px" }}
                    >
                      {ch.desc}
                    </div>
                  </div>
                  {active && (
                    <span className="badge badge-accent" style={{ flexShrink: 0 }}>
                      Active
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Code overlay (DevOracle) */}
        <div className="section">
          <div className="section-header">
            <span className="section-title">
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <Layers size={11} />
                Code Overlay
              </span>
            </span>
          </div>

          <div className="card" style={{ padding: "16px" }}>
            <div className="toggle-row" style={{ marginBottom: "16px" }}>
              <div className="toggle-info">
                <span className="toggle-label">Show code overlay during sessions</span>
                <span className="toggle-desc">
                  Opens the floating hint window when a DevOracle session starts (Cmd+Shift+O
                  / Ctrl+Shift+O toggles anytime)
                </span>
              </div>
              <Toggle
                checked={overlayEnabled}
                onChange={(v) => setOverlayEnabled(v)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: "16px" }}>
              <label className="form-label">
                Panel opacity: {Math.round(overlayOpacity * 100)}%
              </label>
              <input
                className="input"
                type="range"
                min={50}
                max={100}
                value={Math.round(overlayOpacity * 100)}
                onChange={(e) => setOverlayOpacity(Number(e.target.value) / 100)}
                style={{ maxWidth: "100%", accentColor: "var(--accent)" }}
              />
              <span style={{ fontSize: "11px", color: "var(--text-3)" }}>
                50%–100% — applies to the overlay glass background
              </span>
            </div>

            <div style={{ marginBottom: "14px" }}>
              <div
                style={{
                  fontSize: "11px",
                  color: "var(--text-3)",
                  marginBottom: "8px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Preview
              </div>
              <div
                style={{
                  borderRadius: "12px",
                  border: "1px solid rgba(99, 102, 241, 0.3)",
                  background: `rgba(10, 10, 20, ${0.88 * overlayOpacity})`,
                  backdropFilter: "blur(8px)",
                  padding: "10px 12px",
                  maxWidth: "320px",
                }}
              >
                <div
                  style={{
                    fontSize: "10px",
                    fontWeight: 600,
                    display: "inline-block",
                    padding: "2px 8px",
                    borderRadius: "999px",
                    background: "rgba(79, 70, 229, 0.45)",
                    color: "rgba(255,255,255,0.95)",
                    marginBottom: "6px",
                  }}
                >
                  complexity
                </div>
                <div style={{ fontSize: "11px", color: "#fff", lineHeight: 1.45 }}>
                  Consider a trie or prefix tree for O(n) lookup on prefixes…
                </div>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void openOverlay().catch(() => {})}
            >
              Open overlay now
            </button>
          </div>
        </div>

        {/* Hotkey */}
        <div className="section">
          <div className="section-header">
            <span className="section-title">
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <Keyboard size={11} />
                Keyboard Shortcut
              </span>
            </span>
          </div>

          <div className="card">
            <div className="form-group">
              <label className="form-label">Toggle stealth hotkey</label>
              <input
                className="input"
                type="text"
                value={config.hotkey}
                onChange={(e) => update({ hotkey: e.target.value })}
                placeholder="e.g. CmdOrCtrl+H"
                style={{ maxWidth: "280px", fontFamily: "var(--font-mono)" }}
              />
              <span style={{ fontSize: "11px", color: "var(--text-3)" }}>
                Use <code style={{ fontFamily: "var(--font-mono)" }}>CmdOrCtrl</code>,{" "}
                <code style={{ fontFamily: "var(--font-mono)" }}>Shift</code>,{" "}
                <code style={{ fontFamily: "var(--font-mono)" }}>Alt</code> modifiers
              </span>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
