import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Users from "./pages/Users";
import Sessions from "./pages/Sessions";
import QuestionBank from "./pages/QuestionBank";
import QuestionDetail from "./pages/QuestionDetail";
import Competitors from "./pages/Competitors";

function RequireAuth() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let sub: { unsubscribe: () => void } | undefined;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setAuthed(!!session?.access_token);
      setReady(true);
      const { data } = supabase.auth.onAuthStateChange((_e, sess) => {
        setAuthed(!!sess?.access_token);
      });
      sub = data.subscription;
    })();
    return () => sub?.unsubscribe();
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-admin-bg text-admin-muted">
        Caricamento…
      </div>
    );
  }

  if (!authed) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export default function App() {
  return (
    <BrowserRouter basename="/admin">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth />}>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="users" element={<Users />} />
            <Route path="sessions" element={<Sessions />} />
            <Route path="question-bank/:id" element={<QuestionDetail />} />
            <Route path="question-bank" element={<QuestionBank />} />
            <Route path="competitors" element={<Competitors />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
