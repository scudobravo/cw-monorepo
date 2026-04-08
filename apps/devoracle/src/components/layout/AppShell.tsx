import { type ReactNode } from "react";
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
  Zap,
  Repeat,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useStealthStore } from "../../stores/stealthStore";
import { useSessionStore } from "../../stores/sessionStore";
import { useAuthStore } from "../../stores/authStore";

interface NavItem {
  label: string;
  path: string;
  icon: ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", path: "/", icon: <LayoutDashboard size={15} /> },
  { label: "Session",   path: "/session",  icon: <Mic size={15} /> },
  { label: "History",   path: "/history",  icon: <Clock size={15} /> },
  { label: "Drill",     path: "/drill",    icon: <Repeat size={15} /> },
  { label: "Settings",  path: "/settings", icon: <Settings size={15} /> },
];


interface Props {
  children: ReactNode;
  version?: string;
}

export default function AppShell({ children, version }: Props) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { isActive: stealthActive, toggle: toggleStealth } = useStealthStore();
  const { session } = useSessionStore();
  const { signOut, user } = useAuthStore();

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
          <div className="logo-mark" style={{ background: "var(--accent-dim)", border: "1px solid var(--accent-border)" }}>
            <Zap size={12} style={{ color: "var(--accent-light)" }} />
          </div>
          <div>
            <div className="logo-name">DevOracle</div>
            {version && <div className="logo-version">v{version}</div>}
          </div>
        </div>

        {/* Product label */}
        <div style={{ padding: "6px 12px 0" }}>
          <div style={{
            fontSize: "10px",
            color: "var(--accent-light)",
            fontWeight: 600,
            letterSpacing: "0.5px",
            textTransform: "uppercase",
            opacity: 0.7,
          }}>
            Interview AI
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
            <span>Session active</span>
          </div>
        )}

        {/* Footer */}
        <div className="sidebar-footer">
          {/* Stealth toggle */}
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

          {/* Divider */}
          <div style={{ height: "1px", background: "var(--border-1)", margin: "6px 0" }} />

          {/* User + logout */}
          {user && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 8px",
              marginBottom: "2px",
            }}>
              <div style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: "var(--accent-dim)",
                border: "1px solid var(--accent-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "10px",
                fontWeight: 700,
                color: "var(--accent-light)",
                flexShrink: 0,
              }}>
                {(user.email?.[0] ?? "?").toUpperCase()}
              </div>
              <span style={{
                fontSize: "11px",
                color: "var(--text-3)",
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
                {user.email}
              </span>
            </div>
          )}

          {/* Logout */}
          <button
            className="stealth-btn"
            onClick={handleSignOut}
            title="Sign out"
            style={{ color: "var(--text-3)" }}
          >
            <LogOut size={14} />
            <span>Sign out</span>
          </button>

          {/* Quit app */}
          <button
            className="stealth-btn"
            onClick={handleQuit}
            title="Quit DevOracle"
            style={{ color: "var(--text-3)" }}
          >
            <Power size={14} />
            <span>Quit DevOracle</span>
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────── */}
      <main className="main-content">{children}</main>
    </div>
  );
}
