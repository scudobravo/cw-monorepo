import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  listCompetitors,
  upsertCompetitor,
  type AdminCompetitor,
  type UpsertCompetitorBody,
} from "../lib/api";
import { Loader2, Pencil, Plus } from "lucide-react";

function linesToArr(s: string): string[] {
  return s
    .split(/\n/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function arrToLines(a: string[] | null | undefined): string {
  return (a ?? []).join("\n");
}

const emptyForm = {
  id: "" as string,
  name: "",
  aliases: "",
  win_points: "",
  lose_points: "",
  positioning: "",
  trap_questions: "",
  product: "RingWise" as "RingWise" | "DevOracle",
};

export default function Competitors() {
  const [rows, setRows] = useState<AdminCompetitor[]>([]);
  const [productFilter, setProductFilter] = useState<string>("RingWise");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Non autenticato");
      const list = await listCompetitors(
        token,
        productFilter || undefined,
      );
      setRows(list);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Errore");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [productFilter]);

  function editRow(row: AdminCompetitor) {
    setForm({
      id: row.id,
      name: row.name,
      aliases: arrToLines(row.aliases),
      win_points: arrToLines(row.win_points),
      lose_points: arrToLines(row.lose_points),
      positioning: row.positioning,
      trap_questions: arrToLines(row.trap_questions),
      product: row.product as "RingWise" | "DevOracle",
    });
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  }

  function resetForm() {
    setForm(emptyForm);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Non autenticato");

      const body: UpsertCompetitorBody = {
        name: form.name.trim(),
        positioning: form.positioning.trim(),
        product: form.product,
        aliases: linesToArr(form.aliases),
        win_points: linesToArr(form.win_points),
        lose_points: linesToArr(form.lose_points),
        trap_questions: linesToArr(form.trap_questions),
      };
      if (form.id) body.id = form.id;

      await upsertCompetitor(token, body);
      resetForm();
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">Competitor</h1>
      <p className="mt-1 text-sm text-admin-muted">
        Dati comparativi mostrati in tempo reale su RingWise quando un nome viene citato in call.
      </p>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <select
          value={productFilter}
          onChange={(e) => setProductFilter(e.target.value)}
          className="rounded-lg border border-admin-border bg-[#0a0a10] px-3 py-2 text-sm text-white outline-none"
        >
          <option value="">Tutti i prodotti</option>
          <option value="RingWise">RingWise</option>
          <option value="DevOracle">DevOracle</option>
        </select>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-admin-border px-3 py-2 text-sm text-slate-300 hover:bg-white/5"
        >
          Aggiorna elenco
        </button>
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
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Aliases</th>
              <th className="px-4 py-3">Prodotto</th>
              <th className="px-4 py-3 text-right">Azioni</th>
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
                  Nessun competitor
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="text-slate-200">
                  <td className="px-4 py-3 font-medium text-white">{r.name}</td>
                  <td className="max-w-xs truncate px-4 py-3 text-admin-muted" title={(r.aliases ?? []).join(", ")}>
                    {(r.aliases ?? []).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3">{r.product}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => editRow(r)}
                      className="inline-flex items-center gap-1 rounded-lg border border-admin-border px-2 py-1 text-xs text-slate-300 hover:bg-white/5"
                    >
                      <Pencil size={14} />
                      Modifica
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="mt-10 max-w-3xl space-y-4 rounded-xl border border-admin-border bg-[#0a0a12] p-6"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">
            {form.id ? "Modifica competitor" : "Nuovo competitor"}
          </h2>
          <button
            type="button"
            onClick={resetForm}
            className="inline-flex items-center gap-1 rounded-lg border border-admin-border px-3 py-1.5 text-xs text-slate-400 hover:bg-white/5"
          >
            <Plus size={14} />
            Nuovo
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-xs text-admin-muted">
            Nome *
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-admin-border bg-[#050508] px-3 py-2 text-sm text-white outline-none focus:border-admin-accent"
            />
          </label>
          <label className="block text-xs text-admin-muted">
            Prodotto *
            <select
              value={form.product}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  product: e.target.value as "RingWise" | "DevOracle",
                }))
              }
              className="mt-1 w-full rounded-lg border border-admin-border bg-[#050508] px-3 py-2 text-sm text-white outline-none"
            >
              <option value="RingWise">RingWise</option>
              <option value="DevOracle">DevOracle</option>
            </select>
          </label>
        </div>

        <label className="block text-xs text-admin-muted">
          Aliases (uno per riga)
          <textarea
            value={form.aliases}
            onChange={(e) => setForm((f) => ({ ...f, aliases: e.target.value }))}
            rows={2}
            className="mt-1 w-full rounded-lg border border-admin-border bg-[#050508] px-3 py-2 font-mono text-xs text-white outline-none focus:border-admin-accent"
          />
        </label>

        <label className="block text-xs text-admin-muted">
          Positioning (1 riga) *
          <textarea
            required
            value={form.positioning}
            onChange={(e) => setForm((f) => ({ ...f, positioning: e.target.value }))}
            rows={2}
            className="mt-1 w-full rounded-lg border border-admin-border bg-[#050508] px-3 py-2 text-sm text-white outline-none focus:border-admin-accent"
          />
        </label>

        <label className="block text-xs text-admin-muted">
          Where we win (uno per riga)
          <textarea
            value={form.win_points}
            onChange={(e) => setForm((f) => ({ ...f, win_points: e.target.value }))}
            rows={3}
            className="mt-1 w-full rounded-lg border border-admin-border bg-[#050508] px-3 py-2 font-mono text-xs text-white outline-none focus:border-admin-accent"
          />
        </label>

        <label className="block text-xs text-admin-muted">
          Watch out (uno per riga)
          <textarea
            value={form.lose_points}
            onChange={(e) => setForm((f) => ({ ...f, lose_points: e.target.value }))}
            rows={3}
            className="mt-1 w-full rounded-lg border border-admin-border bg-[#050508] px-3 py-2 font-mono text-xs text-white outline-none focus:border-admin-accent"
          />
        </label>

        <label className="block text-xs text-admin-muted">
          Trap questions (uno per riga, max consigliato 3)
          <textarea
            value={form.trap_questions}
            onChange={(e) => setForm((f) => ({ ...f, trap_questions: e.target.value }))}
            rows={4}
            className="mt-1 w-full rounded-lg border border-admin-border bg-[#050508] px-3 py-2 font-mono text-xs text-white outline-none focus:border-admin-accent"
          />
        </label>

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {saving ? "Salvataggio…" : "Salva"}
        </button>
      </form>
    </div>
  );
}
