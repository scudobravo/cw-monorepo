import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { LayoutDashboard, Users, Layers, BookOpen, LogOut, Target } from "lucide-react";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/users", label: "Utenti", icon: Users },
  { to: "/sessions", label: "Sessioni", icon: Layers },
  { to: "/question-bank", label: "Question bank", icon: BookOpen },
  { to: "/competitors", label: "Competitor", icon: Target },
];

export default function Layout() {
  const navigate = useNavigate();

  async function logout() {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen bg-admin-bg">
      <aside className="fixed left-0 top-0 z-20 flex h-full w-56 flex-col border-r border-admin-border bg-[#0c0c14]">
        <div className="border-b border-admin-border px-4 py-5">
          <div className="text-sm font-semibold text-white">RingWise Admin</div>
          <div className="text-xs text-admin-muted">Pannello operativo</div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          onClick={() => void logout()}
          className="m-3 flex items-center gap-2 rounded-lg border border-admin-border px-3 py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-white"
        >
          <LogOut size={16} />
          Esci
        </button>
      </aside>
      <main className="ml-56 flex-1 p-8">
        <Outlet />
      </main>
    </div>
  );
}
