import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { adminFetch, type AdminStats } from "../lib/api";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Loader2 } from "lucide-react";

export default function Dashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) throw new Error("Non autenticato");
        const s = await adminFetch<AdminStats>("/admin/api/stats", token);
        if (!cancelled) setStats(s);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Errore");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-admin-muted">
        <Loader2 className="animate-spin" size={22} />
        Caricamento metriche…
      </div>
    );
  }

  if (err || !stats) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
        {err ?? "Nessun dato"}
      </div>
    );
  }

  const hits = stats.question_bank_total_hits;
  const cues = stats.sessions_total_cues;
  const pieSum = hits + cues;
  const pieData = [
    { name: "Question bank (hits)", value: hits },
    { name: "Cue sessione (stim.)", value: cues },
  ].filter((d) => d.value > 0);
  const COLORS = ["#818cf8", "#34d399"];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
      <p className="mt-1 text-sm text-admin-muted">Panoramica piattaforma</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Utenti totali" value={stats.total_users} />
        <StatCard label="Sessioni attive (aperte)" value={stats.active_sessions} />
        <StatCard label="MRR stimato (USD)" value={`$${stats.mrr_estimate.toFixed(0)}`} />
        <StatCard label="Sessioni oggi" value={stats.sessions_today} />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div className="rounded-xl border border-admin-border bg-admin-card p-6">
          <h2 className="text-sm font-medium text-slate-300">Cache hit rate (proxy)</h2>
          <p className="mt-1 text-3xl font-semibold text-white">
            {(stats.cache_hit_rate * 100).toFixed(1)}%
          </p>
          <p className="mt-2 text-xs text-admin-muted">
            Rapporto tra hit sul question bank e volume cue nelle sessioni chiuse.
          </p>
        </div>
        <div className="rounded-xl border border-admin-border bg-admin-card p-4">
          <h2 className="mb-2 px-2 text-sm font-medium text-slate-300">Distribuzione cue</h2>
          <div className="flex h-56 w-full items-center justify-center">
            {pieSum === 0 ? (
              <p className="text-sm text-admin-muted">Nessun dato ancora disponibile</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#12121c", border: "1px solid rgba(255,255,255,0.1)" }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-admin-border bg-admin-card px-5 py-4">
      <div className="text-xs font-medium uppercase tracking-wide text-admin-muted">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}
