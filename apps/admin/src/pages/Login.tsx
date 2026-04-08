import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Login() {
  const navigate = useNavigate();

  useEffect(() => {
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token && session.user?.user_metadata?.["is_admin"] === true) {
        navigate("/", { replace: true });
      }
    })();
  }, [navigate]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data, error: err } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (err) throw err;
      const isAdmin = data.user?.user_metadata?.["is_admin"] === true;
      if (!isAdmin) {
        await supabase.auth.signOut();
        throw new Error("Accesso riservato agli amministratori.");
      }
      navigate("/", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login fallito");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-admin-bg px-4">
      <div className="w-full max-w-md rounded-xl border border-admin-border bg-admin-card p-8 shadow-xl">
        <h1 className="text-xl font-semibold text-white">Admin login</h1>
        <p className="mt-1 text-sm text-admin-muted">
          Accedi con un account Supabase con{" "}
          <code className="rounded bg-white/10 px-1">is_admin: true</code>
        </p>
        <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400">Email</label>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-admin-border bg-[#0a0a10] px-3 py-2 text-sm text-white outline-none focus:border-admin-accent"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400">Password</label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-admin-border bg-[#0a0a10] px-3 py-2 text-sm text-white outline-none focus:border-admin-accent"
              required
            />
          </div>
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading ? "Accesso…" : "Entra"}
          </button>
        </form>
      </div>
    </div>
  );
}
