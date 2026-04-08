import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { adminFetch, type AdminUser } from "../lib/api";
import { Loader2, Search } from "lucide-react";

export default function Users() {
  const [rows, setRows] = useState<AdminUser[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [product, setProduct] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) throw new Error("Non autenticato");
        const qs = new URLSearchParams();
        if (search.trim()) qs.set("search", search.trim());
        if (product) qs.set("product", product);
        const q = qs.toString();
        const list = await adminFetch<AdminUser[]>(
          `/admin/api/users${q ? `?${q}` : ""}`,
          token,
        );
        if (!cancelled) setRows(list);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Errore");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [search, product]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">Utenti</h1>
      <p className="mt-1 text-sm text-admin-muted">Profili e conteggio sessioni</p>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-admin-muted" />
          <input
            placeholder="Cerca email…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-64 rounded-lg border border-admin-border bg-[#0a0a10] py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-admin-accent"
          />
        </div>
        <select
          value={product}
          onChange={(e) => setProduct(e.target.value)}
          className="rounded-lg border border-admin-border bg-[#0a0a10] px-3 py-2 text-sm text-white outline-none"
        >
          <option value="">Tutti i prodotti (sessioni)</option>
          <option value="DevOracle">DevOracle</option>
          <option value="RingWise">RingWise</option>
        </select>
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
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Piano</th>
              <th className="px-4 py-3">Ultimo aggiornamento</th>
              <th className="px-4 py-3 text-right">Sessioni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-admin-border">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-admin-muted">
                  <Loader2 className="mx-auto animate-spin" size={22} />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-admin-muted">
                  Nessun utente trovato
                </td>
              </tr>
            ) : (
              rows.map((u) => (
                <tr key={u.id} className="hover:bg-white/[0.03]">
                  <td className="px-4 py-3 text-slate-200">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs">{u.plan}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {new Date(u.last_seen).toLocaleString("it-IT")}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-300">{u.session_count}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
