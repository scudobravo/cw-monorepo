import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { adminFetch, type AdminQuestionList } from "../lib/api";
import { Loader2, Trash2, Eye } from "lucide-react";

export default function QuestionBank() {
  const [rows, setRows] = useState<AdminQuestionList[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Non autenticato");
      const list = await adminFetch<AdminQuestionList[]>("/admin/api/question-bank", token);
      setRows(list);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Errore");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function remove(id: string) {
    if (!confirm("Eliminare questa voce dal question bank?")) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Non autenticato");
      await adminFetch(`/admin/api/question-bank/${id}`, token, { method: "DELETE" });
      setRows((r) => r.filter((x) => x.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Errore eliminazione");
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">Question bank</h1>
      <p className="mt-1 text-sm text-admin-muted">
        Domande / obiezioni con statistiche embedding
      </p>

      {err && (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {err}
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-xl border border-admin-border">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-admin-border bg-white/5 text-xs uppercase text-admin-muted">
            <tr>
              <th className="px-4 py-3">Testo</th>
              <th className="px-4 py-3">Prodotto</th>
              <th className="px-4 py-3">Modalità</th>
              <th className="px-4 py-3">asked</th>
              <th className="px-4 py-3">Embedding</th>
              <th className="px-4 py-3 text-right">Azioni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-admin-border">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-admin-muted">
                  <Loader2 className="mx-auto animate-spin" size={22} />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-admin-muted">
                  Nessuna domanda
                </td>
              </tr>
            ) : (
              rows.map((q) => (
                <tr key={q.id} className="hover:bg-white/[0.03]">
                  <td className="max-w-md px-4 py-3 text-slate-300">
                    <span className="line-clamp-2">{q.text}</span>
                  </td>
                  <td className="px-4 py-3">{q.product}</td>
                  <td className="px-4 py-3">{q.mode}</td>
                  <td className="px-4 py-3 font-mono">{q.asked_count}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {q.has_embedding ? `${q.embedding_dimensions}d` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/question-bank/${q.id}`}
                      className="inline-flex rounded p-1.5 text-indigo-400 hover:bg-white/10"
                      title="Dettaglio"
                    >
                      <Eye size={16} />
                    </Link>
                    <button
                      type="button"
                      onClick={() => void remove(q.id)}
                      className="ml-1 inline-flex rounded p-1.5 text-red-400 hover:bg-red-500/10"
                      title="Elimina"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
