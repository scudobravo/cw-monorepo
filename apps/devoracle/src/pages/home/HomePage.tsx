import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Mic,
  Zap,
  PhoneCall,
  Code2,
  LayoutTemplate,
  BrainCircuit,
  ArrowRight,
  Activity,
  CheckCircle2,
} from "lucide-react";
import { getAppVersion, listAudioDevices, type AudioDevice } from "../../lib/tauri";
import { useStealthStore } from "../../stores/stealthStore";
import { useProductStore } from "../../stores/productStore";
import AppShell from "../../components/layout/AppShell";
import { useAuthStore } from "../../stores/authStore";
import { useSessionStore } from "../../stores/sessionStore";
import { getCompanies, type CompanyRow } from "../../lib/api";


const CW_MODES = [
  {
    label: "Coding Interview",
    desc: "Real-time hints & complexity analysis",
    icon: <Code2 size={16} />,
    color: "indigo",
    mode: { product: "DevOracle" as const, mode: "coding_interview" },
  },
  {
    label: "Mock Interview",
    desc: "Behavioral & system design coaching",
    icon: <BrainCircuit size={16} />,
    color: "blue",
    mode: { product: "DevOracle" as const, mode: "mock_interview" },
  },
  {
    label: "System Design",
    desc: "Architecture guidance on the fly",
    icon: <LayoutTemplate size={16} />,
    color: "amber",
    mode: { product: "DevOracle" as const, mode: "system_design" },
  },
];

const CC_MODES = [
  {
    label: "Sales Call",
    desc: "Live objection handling & closing cues",
    icon: <PhoneCall size={16} />,
    color: "green",
    mode: { product: "RingWise" as const, mode: "sales_call" },
  },
  {
    label: "Discovery",
    desc: "Pain-point mapping & MEDDIC guidance",
    icon: <Activity size={16} />,
    color: "blue",
    mode: { product: "RingWise" as const, mode: "discovery" },
  },
];

export default function HomePage() {
  const navigate = useNavigate();
  const [version, setVersion] = useState("");
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const { loadConfig } = useStealthStore();
  const { active: activeProduct, setActive } = useProductStore();
  const { token } = useAuthStore();
  const targetCompany = useSessionStore((s) => s.targetCompany);
  const setTargetCompany = useSessionStore((s) => s.setTargetCompany);

  const loadCompanies = useCallback(() => {
    const t = token();
    if (!t) return;
    getCompanies(t)
      .then((res) => setCompanies(res.items))
      .catch(() => setCompanies([]));
  }, [token]);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  useEffect(() => {
    getAppVersion().then(setVersion).catch(() => {});
    listAudioDevices().then(setDevices).catch(() => {});
    loadConfig();
  }, [loadConfig]);

  const modes = activeProduct === "DevOracle" ? CW_MODES : CC_MODES;
  const defaultDevice = devices.find((d) => d.is_default);

  return (
    <AppShell version={version}>
      <div className="page fade-in">
        {/* Page header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">
              {activeProduct === "DevOracle"
                ? "Interview AI assistant"
                : "Sales call AI assistant"}
            </p>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => navigate("/session")}
          >
            <Mic size={14} />
            New Session
          </button>
        </div>

        {/* Status strip */}
        <div
          className="card"
          style={{
            marginBottom: "20px",
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 0,
            padding: 0,
            overflow: "hidden",
          }}
        >
          {[
            {
              icon: <Mic size={15} />,
              label: "Microphone",
              value: defaultDevice?.name ?? "No device",
              ok: !!defaultDevice,
            },
            {
              icon: <Zap size={15} />,
              label: "AI engine",
              value: "Ready",
              ok: true,
            },
            {
              icon: <CheckCircle2 size={15} />,
              label: "Stealth mode",
              value: "Available",
              ok: true,
            },
          ].map((s, i) => (
            <div
              key={i}
              style={{
                padding: "14px 16px",
                borderRight: i < 2 ? "1px solid var(--border-1)" : undefined,
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "var(--r-md)",
                  background: s.ok ? "var(--green-dim)" : "var(--red-dim)",
                  border: s.ok
                    ? "1px solid rgba(34,197,94,0.2)"
                    : "1px solid rgba(239,68,68,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: s.ok ? "var(--green)" : "var(--red)",
                  flexShrink: 0,
                }}
              >
                {s.icon}
              </div>
              <div>
                <div className="stat-label">{s.label}</div>
                <div
                  className="stat-value truncate"
                  style={{ maxWidth: "140px" }}
                >
                  {s.value}
                </div>
              </div>
            </div>
          ))}
        </div>

        {activeProduct === "DevOracle" && companies.length > 0 && (
          <div className="section">
            <div className="section-header">
              <span className="section-title">Target company (optional)</span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(112px, 1fr))",
                gap: "10px",
              }}
            >
              {companies.map((c) => {
                const selected = targetCompany === c.slug;
                const topicsHint =
                  c.common_topics?.length > 0
                    ? c.common_topics.slice(0, 4).join(", ")
                    : c.interview_style.slice(0, 80);
                return (
                  <button
                    key={c.slug}
                    type="button"
                    title={`Known for: ${topicsHint}`}
                    onClick={() =>
                      setTargetCompany(selected ? null : c.slug)
                    }
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "6px",
                      padding: "12px 10px",
                      borderRadius: "var(--r-md)",
                      border: selected
                        ? "1px solid var(--accent-border)"
                        : "1px solid var(--border-1)",
                      background: selected ? "var(--accent-dim)" : "var(--bg-card)",
                      color: "var(--text-1)",
                      fontSize: "11px",
                      fontWeight: 600,
                      textAlign: "center",
                      lineHeight: 1.35,
                      transition: "border-color var(--t-fast), background var(--t-fast)",
                    }}
                  >
                    <span style={{ fontSize: "22px" }} aria-hidden>
                      {c.logo_emoji}
                    </span>
                    <span>{c.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick start modes */}
        <div className="section">
          <div className="section-header">
            <span className="section-title">Quick Start</span>
            <span className="text-xs text-subtle">{activeProduct}</span>
          </div>
          <div className="card-grid-3">
            {modes.map(({ label, desc, icon, color, mode }) => (
              <div
                key={label}
                className="card card-interactive mode-card"
                onClick={() =>
                  navigate("/session", { state: { mode } })
                }
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
                  <ArrowRight size={13} style={{ color: "var(--text-3)" }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Both products teaser when not active */}
        <div className="section">
          <div className="section-header">
            <span className="section-title">Products</span>
          </div>
          <div className="card-grid-2">
            {/* DevOracle card */}
            <div
              className={`card${activeProduct === "DevOracle" ? "" : " card-interactive"}`}
              style={{
                border:
                  activeProduct === "DevOracle"
                    ? "1px solid var(--accent-border)"
                    : undefined,
              }}
            >
              <div className="product-hero">
                <div className="product-hero-badge cw">
                  <Code2 size={11} />
                  DevOracle
                </div>
                <div>
                  <div className="product-hero-title">Ace every interview</div>
                  <div className="product-hero-desc mt-1">
                    Real-time AI coaching for coding, behavioral, and system
                    design interviews. Stealth overlay keeps hints invisible to
                    your interviewer.
                  </div>
                </div>
                {activeProduct !== "DevOracle" && (
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ width: "fit-content" }}
                    onClick={() => setActive("DevOracle")}
                  >
                    Switch
                  </button>
                )}
                {activeProduct === "DevOracle" && (
                  <span className="badge badge-accent">Active</span>
                )}
              </div>
            </div>

            {/* RingWise card */}
            <div
              className={`card${activeProduct === "RingWise" ? "" : " card-interactive"}`}
              style={{
                border:
                  activeProduct === "RingWise"
                    ? "1px solid rgba(34,197,94,0.28)"
                    : undefined,
              }}
            >
              <div className="product-hero">
                <div className="product-hero-badge cc">
                  <PhoneCall size={11} />
                  RingWise
                </div>
                <div>
                  <div className="product-hero-title">Close more deals</div>
                  <div className="product-hero-desc mt-1">
                    Live AI assistance for discovery calls and demos. Get
                    real-time objection handling and closing cues delivered
                    silently.
                  </div>
                </div>
                {activeProduct !== "RingWise" && (
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ width: "fit-content" }}
                    onClick={() => setActive("RingWise")}
                  >
                    Switch
                  </button>
                )}
                {activeProduct === "RingWise" && (
                  <span
                    className="badge badge-green"
                    style={{ width: "fit-content" }}
                  >
                    Active
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Audio devices */}
        {devices.length > 0 && (
          <div className="section">
            <div className="section-header">
              <span className="section-title">Audio Devices</span>
            </div>
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              {devices.map((d, i) => (
                <div
                  key={d.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px 14px",
                    borderBottom:
                      i < devices.length - 1
                        ? "1px solid var(--border-1)"
                        : undefined,
                  }}
                >
                  <Mic size={13} style={{ color: "var(--text-3)", flexShrink: 0 }} />
                  <span
                    className="truncate"
                    style={{ fontSize: "12px", color: "var(--text-2)", flex: 1 }}
                  >
                    {d.name}
                  </span>
                  {d.is_default && (
                    <span className="badge badge-default">Default</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
