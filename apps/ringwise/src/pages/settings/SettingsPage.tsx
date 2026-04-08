import { useEffect, useState } from "react";
import { Loader2, Mic, EyeOff, Info } from "lucide-react";
import AppShell from "../../components/layout/AppShell";
import { useStealthStore } from "../../stores/stealthStore";
import { listAudioDevices, getAppVersion, type AudioDevice, type StealthOutputChannel } from "../../lib/tauri";

const OUTPUT_CHANNELS: { value: StealthOutputChannel; label: string; description: string }[] = [
  { value: "overlay",       label: "Overlay",        description: "Transparent always-on-top window (stealth)" },
  { value: "second_screen", label: "Second screen",  description: "Show cues on a secondary display only" },
  { value: "system_tray",   label: "System tray",    description: "Minimalist tray notifications" },
  { value: "haptic",        label: "Haptic",         description: "Vibration alerts (mobile companion, coming soon)" },
];

export default function SettingsPage() {
  const { config, isLoading, loadConfig, updateConfig, toggle, isActive } = useStealthStore();
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [version, setVersion] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConfig();
    listAudioDevices().then(setDevices).catch(() => {});
    getAppVersion().then(setVersion).catch(() => {});
  }, [loadConfig]);

  const handleChannelChange = async (channel: StealthOutputChannel) => {
    if (!config) return;
    setSaving(true);
    await updateConfig({ ...config, output_channel: channel });
    setSaving(false);
  };

  const handleToggleAutoHide = async () => {
    if (!config) return;
    setSaving(true);
    await updateConfig({ ...config, auto_hide_during_calls: !config.auto_hide_during_calls });
    setSaving(false);
  };

  const handleToggleScreenExclude = async () => {
    if (!config) return;
    setSaving(true);
    await updateConfig({ ...config, exclude_from_screen_capture: !config.exclude_from_screen_capture });
    setSaving(false);
  };

  return (
    <AppShell version={version ?? undefined}>
      <div className="page-container fade-in">
        <div className="page-header">
          <div>
            <h1 className="page-title">Settings</h1>
            <p className="page-subtitle">Configure Cue to stay invisible during your calls.</p>
          </div>
          {saving && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-3)" }}>
              <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
              Saving…
            </div>
          )}
        </div>

        {/* Audio */}
        <div className="section-label" style={{ marginBottom: "10px" }}>
          <Mic size={12} style={{ display: "inline", marginRight: "5px" }} />
          Audio input
        </div>
        <div className="card" style={{ padding: "16px", marginBottom: "16px" }}>
          <p style={{ fontSize: "12px", color: "var(--text-3)", marginBottom: "12px" }}>
            Cue listens to your microphone to transcribe the call in real time. Select the device
            capturing your voice (not the meeting audio — that comes from the call software).
          </p>
          <div className="form-group">
            <label className="form-label">Microphone device</label>
            <select className="input select">
              {devices.length === 0 ? (
                <option>Loading devices…</option>
              ) : (
                devices.map((d) => (
                  <option key={d.name} value={d.name}>
                    {d.name} {d.is_default ? "(default)" : ""}
                  </option>
                ))
              )}
            </select>
          </div>
          {isLoading && (
            <div style={{ fontSize: "11px", color: "var(--text-4)", marginTop: "6px" }}>
              Scanning audio devices…
            </div>
          )}
        </div>

        {/* Stealth */}
        <div className="section-label" style={{ marginBottom: "10px" }}>
          <EyeOff size={12} style={{ display: "inline", marginRight: "5px" }} />
          Stealth mode
        </div>
        <div className="card" style={{ padding: "16px", marginBottom: "16px" }}>
          <p style={{ fontSize: "12px", color: "var(--text-3)", marginBottom: "16px" }}>
            Stealth mode hides Cue's window from screen sharing and recording tools. Enable it
            before any call where your prospect might see your screen.
          </p>

          {/* Global stealth toggle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "14px",
            }}
          >
            <div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-1)" }}>
                Stealth active
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-4)" }}>
                Toggle with {config?.hotkey ?? "Cmd+H"} or the sidebar button
              </div>
            </div>
            <button
              className={`stealth-btn${isActive ? " on" : ""}`}
              onClick={toggle}
              style={{ flexShrink: 0 }}
            >
              <EyeOff size={14} />
              <span>{isActive ? "ON" : "OFF"}</span>
            </button>
          </div>

          {/* Auto-hide */}
          <label style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={config?.auto_hide_during_calls ?? false}
              onChange={handleToggleAutoHide}
              style={{ accentColor: "var(--accent)" }}
            />
            <div>
              <div style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-2)" }}>
                Auto-activate when call is detected
              </div>
              <div style={{ fontSize: "10px", color: "var(--text-4)" }}>
                Cue watches for Zoom, Teams, Meet, Webex and enables stealth automatically
              </div>
            </div>
          </label>

          {/* Screen capture exclusion */}
          <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={config?.exclude_from_screen_capture ?? false}
              onChange={handleToggleScreenExclude}
              style={{ accentColor: "var(--accent)" }}
            />
            <div>
              <div style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-2)" }}>
                Exclude from screen capture (macOS)
              </div>
              <div style={{ fontSize: "10px", color: "var(--text-4)" }}>
                Uses NSWindowSharingNone — window is invisible to all capture tools
              </div>
            </div>
          </label>
        </div>

        {/* Output channel */}
        <div className="section-label" style={{ marginBottom: "10px" }}>Output channel</div>
        <div className="card" style={{ padding: "4px 0", marginBottom: "16px" }}>
          {OUTPUT_CHANNELS.map((ch, i) => (
            <label
              key={ch.value}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                padding: "12px 16px",
                borderBottom:
                  i < OUTPUT_CHANNELS.length - 1 ? "1px solid var(--border-1)" : "none",
                cursor: "pointer",
              }}
            >
              <input
                type="radio"
                name="output_channel"
                value={ch.value}
                checked={config?.output_channel === ch.value}
                onChange={() => handleChannelChange(ch.value)}
                style={{ marginTop: "2px", accentColor: "var(--accent)" }}
              />
              <div>
                <div style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-2)" }}>
                  {ch.label}
                </div>
                <div style={{ fontSize: "10px", color: "var(--text-4)" }}>{ch.description}</div>
              </div>
            </label>
          ))}
        </div>

        {/* About */}
        <div className="section-label" style={{ marginBottom: "10px" }}>
          <Info size={12} style={{ display: "inline", marginRight: "5px" }} />
          About
        </div>
        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-1)" }}>Cue</div>
              <div style={{ fontSize: "11px", color: "var(--text-4)" }}>AI Sales Coach</div>
            </div>
            <div
              style={{
                fontSize: "11px",
                color: "var(--text-3)",
                background: "var(--bg-app)",
                border: "1px solid var(--border-1)",
                borderRadius: "var(--r-sm)",
                padding: "3px 8px",
              }}
            >
              v{version ?? "—"}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </AppShell>
  );
}
