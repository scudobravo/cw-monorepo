import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { adminFetch, type AdminQuestionDetail } from "../lib/api";
import { Loader2, ArrowLeft } from "lucide-react";

export default function QuestionDetail() {
  const { id } = useParams<{ id: string }>();
  const [row, setRow] = useState<AdminQuestionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) throw new Error("Non autenticato");
        const q = await adminFetch<AdminQuestionDetail>(
          `/admin/api/question-bank/${id}`,
          token,
        );
        if (!cancelled) setRow(q);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Errore");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-admin-muted">
        <Loader2 className="animate-spin" size={22} />
        Caricamento…
      </div>
    );
  }

  if (err || !row) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
        {err ?? "Non trovato"}
      </div>
    );
  }

  return (
    <div>
      <Link
        to="/question-bank"
        className="mb-6 inline-flex items-center gap-1 text-sm text-indigo-400 hover:underline"
      >
        <ArrowLeft size={16} /> Torna al question bank
      </Link>
      <h1 className="text-2xl font-semibold text-white">Dettaglio domanda</h1>
      <div className="mt-6 space-y-6 rounded-xl border border-admin-border bg-admin-card p-6">
        <div>
          <div className="text-xs font-medium uppercase text-admin-muted">Modalità</div>
          <div className="mt-1 text-slate-200">
            {row.product} / {row.mode}
          </div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase text-admin-muted">Testo</div>
          <p className="mt-2 whitespace-pre-wrap text-slate-200">{row.text}</p>
        </div>
        <div>
          <div className="text-xs font-medium uppercase text-admin-muted">
            Risposta AI (cached)
          </div>
          <p className="mt-2 whitespace-pre-wrap rounded-lg bg-black/30 p-4 text-slate-200">
            {row.answer}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="text-xs text-admin-muted">Tipo suggestion</div>
            <div className="text-slate-300">{row.suggestion_type}</div>
          </div>
          <div>
            <div className="text-xs text-admin-muted">Chiesto (count)</div>
            <div className="font-mono text-slate-300">{row.asked_count}</div>
          </div>
          <div>
            <div className="text-xs text-admin-muted">Creato</div>
            <div className="text-slate-400">
              {new Date(row.created_at).toLocaleString("it-IT")}
            </div>
          </div>
          <div>
            <div className="text-xs text-admin-muted">Embedding</div>
            <div className="text-slate-400">
              {row.has_embedding ? `${row.embedding_dimensions} dimensioni` : "assente"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
