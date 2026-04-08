import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { adminFetch, type AdminSessionsResponse } from "../lib/api";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";

export default function Sessions() {
  const [data, setData] = useState<AdminSessionsResponse | null>(null);
  const [page, setPage] = useState(1);
  const [product, setProduct] = useState("");
  const [mode, setMode] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const limit = 15;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) throw new Error("Non autenticato");
        const qs = new URLSearchParams({
          page: String(page),
          limit: String(limit),
        });
        if (product) qs.set("product", product);
        if (mode.trim()) qs.set("mode", mode.trim());
        const res = await adminFetch<AdminSessionsResponse>(
          `/admin/api/sessions?${qs.toString()}`,
          token,
        );
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Errore");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page, product, mode]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / limit)) : 1;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">Sessioni</h1>
      <p className="mt-1 text-sm text-admin-muted">Tutte le sessioni registrate</p>

      <div className="mt-6 flex flex-wrap gap-3">
        <select
          value={product}
          onChange={(e) => {
            setPage(1);
            setProduct(e.target.value);
          }}
          className="rounded-lg border border-admin-border bg-[#0a0a10] px-3 py-2 text-sm text-white"
        >
          <option value="">Prodotto</option>
          <option value="DevOracle">DevOracle</option>
          <option value="RingWise">RingWise</option>
        </select>
        <input
          placeholder="Modalità (es. coding_interview)"
          value={mode}
          onChange={(e) => {
            setPage(1);
            setMode(e.target.value);
          }}
          className="rounded-lg border border-admin-border bg-[#0a0a10] px-3 py-2 text-sm text-white"
        />
      </div>

      {err && (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {err}
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-xl border border-admin-border">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-admin-border bg-white/5 text-xs uppercase text-admin-muted">
            <tr>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Prodotto</th>
              <th className="px-4 py-3">Modalità</th>
              <th className="px-4 py-3">Inizio</th>
              <th className="px-4 py-3">Cue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-admin-border">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-admin-muted">
                  <Loader2 className="mx-auto animate-spin" size={22} />
                </td>
              </tr>
            ) : !data?.items.length ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-admin-muted">
                  Nessuna sessione
                </td>
              </tr>
            ) : (
              data.items.map((s) => (
                <tr key={s.id} className="hover:bg-white/[0.03]">
                  <td className="max-w-[140px] truncate px-4 py-3 font-mono text-xs text-slate-400" title={s.id}>
                    {s.id.slice(0, 8)}…
                  </td>
                  <td className="max-w-[100px] truncate px-4 py-3 font-mono text-xs text-slate-500">
                    {s.user_id.slice(0, 8)}…
                  </td>
                  <td className="px-4 py-3">{s.product}</td>
                  <td className="px-4 py-3">{s.mode}</td>
                  <td className="px-4 py-3 text-slate-400">
                    {new Date(s.started_at).toLocaleString("it-IT")}
                  </td>
                  <td className="px-4 py-3">{s.total_suggestions ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data && data.total > limit && (
        <div className="mt-4 flex items-center justify-between text-sm text-admin-muted">
          <span>
            {data.total} sessioni · pagina {page} / {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="flex items-center gap-1 rounded-lg border border-admin-border px-3 py-1 hover:bg-white/5 disabled:opacity-40"
            >
              <ChevronLeft size={16} /> Indietro
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="flex items-center gap-1 rounded-lg border border-admin-border px-3 py-1 hover:bg-white/5 disabled:opacity-40"
            >
              Avanti <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
