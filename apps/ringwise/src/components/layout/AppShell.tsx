import { type ReactNode, useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Mic,
  Clock,
  Settings,
  EyeOff,
  Eye,
  ChevronRight,
  LogOut,
  Power,
  Radio,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useStealthStore } from "../../stores/stealthStore";
import { useSessionStore } from "../../stores/sessionStore";
import { useAuthStore } from "../../stores/authStore";
import { getUsage, type UsageInfo } from "../../lib/api";

interface NavItem {
  label: string;
  path: string;
  icon: ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", path: "/",         icon: <LayoutDashboard size={15} /> },
  { label: "Session",   path: "/session",  icon: <Mic size={15} /> },
  { label: "History",   path: "/history",  icon: <Clock size={15} /> },
  { label: "Settings",  path: "/settings", icon: <Settings size={15} /> },
];

const ACCENT = "#10b981";

function usageColor(percent: number): string {
  if (percent >= 90) return "#ef4444";
  if (percent >= 70) return "#f59e0b";
  return ACCENT;
}

interface Props {
  children: ReactNode;
  version?: string;
}

export default function AppShell({ children, version }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isActive: stealthActive, toggle: toggleStealth } = useStealthStore();
  const { session } = useSessionStore();
  const { signOut, user, token } = useAuthStore();
  const [usage, setUsage] = useState<UsageInfo | null>(null);

  useEffect(() => {
    const t = token();
    if (!t) return;
    getUsage(t).then(setUsage).catch(() => {});
  }, [token]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  const handleQuit = async () => {
    await invoke("quit_app").catch(() => window.close());
  };

  return (
    <div className="app-layout">
      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside className="sidebar">

        {/* Logo */}
        <div className="sidebar-logo">
          <div className="logo-mark" style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)" }}>
            <Radio size={12} style={{ color: ACCENT }} />
          </div>
          <div>
            <div className="logo-name">RingWise</div>
            {version && <div className="logo-version">v{version}</div>}
          </div>
        </div>

        {/* Product label */}
        <div style={{ padding: "6px 12px 0" }}>
          <div style={{
            fontSize: "10px",
            color: ACCENT,
            fontWeight: 600,
            letterSpacing: "0.5px",
            textTransform: "uppercase",
            opacity: 0.8,
          }}>
            Sales AI
          </div>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          <div className="sidebar-section-label" style={{ marginTop: "12px" }}>
            Navigate
          </div>
          {NAV_ITEMS.map((item) => (
            <div
              key={item.path}
              className={`nav-item${location.pathname === item.path ? " active" : ""}`}
              onClick={() => navigate(item.path)}
            >
              {item.icon}
              <span>{item.label}</span>
              {location.pathname === item.path && (
                <ChevronRight size={11} style={{ marginLeft: "auto", opacity: 0.5 }} />
              )}
            </div>
          ))}
        </nav>

        {/* Session active pill */}
        {session && (
          <div
            className="session-pill"
            style={{ cursor: "pointer" }}
            onClick={() => navigate("/session")}
          >
            <span className="dot dot-green dot-pulse" />
            <span>Call active</span>
          </div>
        )}

        {/* Usage bar */}
        {usage && (
          <div style={{ padding: "10px 12px 4px", marginTop: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
              <span style={{ fontSize: "10px", color: "var(--text-4)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px" }}>
                {usage.planName} · {usage.percent}%
              </span>
              {usage.percent >= 70 && (
                <a
                  href="https://ringwise.uk/pricing"
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: "10px", color: ACCENT, fontWeight: 600, textDecoration: "none" }}
                >
                  Upgrade ↗
                </a>
              )}
            </div>
            <div style={{ height: "4px", borderRadius: "2px", background: "var(--border-1)", overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${usage.percent}%`,
                borderRadius: "2px",
                background: usageColor(usage.percent),
                transition: "width 0.4s ease",
              }} />
            </div>
            <div style={{ fontSize: "10px", color: "var(--text-4)", marginTop: "4px" }}>
              {(usage.used / 1000).toFixed(0)}k / {(usage.limit / 1000).toFixed(0)}k token
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="sidebar-footer">
          <button
            className={`stealth-btn${stealthActive ? " on" : ""}`}
            onClick={toggleStealth}
            title="Toggle stealth mode (hides window from screen recording)"
          >
            {stealthActive ? <EyeOff size={14} /> : <Eye size={14} />}
            <span>
              Stealth{" "}
              <strong style={{ opacity: 0.8 }}>
                {stealthActive ? "ON" : "OFF"}
              </strong>
            </span>
          </button>

          <div style={{ height: "1px", background: "var(--border-1)", margin: "6px 0" }} />

          {user && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "4px 8px", marginBottom: "2px" }}>
              <div style={{
                width: 22, height: 22, borderRadius: "50%",
                background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "10px", fontWeight: 700, color: ACCENT, flexShrink: 0,
              }}>
                {(user.email?.[0] ?? "?").toUpperCase()}
              </div>
              <span style={{ fontSize: "11px", color: "var(--text-3)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user.email}
              </span>
            </div>
          )}

          <button className="stealth-btn" onClick={handleSignOut} title="Sign out" style={{ color: "var(--text-3)" }}>
            <LogOut size={14} />
            <span>Sign out</span>
          </button>

          <button className="stealth-btn" onClick={handleQuit} title="Quit RingWise" style={{ color: "var(--text-3)" }}>
            <Power size={14} />
            <span>Quit RingWise</span>
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────── */}
      <main className="main-content">{children}</main>
    </div>
  );
}
