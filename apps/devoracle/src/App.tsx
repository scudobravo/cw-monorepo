import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import AuthPage from './pages/auth/AuthPage';
import HomePage from './pages/home/HomePage';
import SessionPage from './pages/session/SessionPage';
import SettingsPage from './pages/settings/SettingsPage';
import HistoryPage from './pages/history/HistoryPage';
import OverlayPage from './pages/overlay/OverlayPage';
import SessionSummaryPage from './pages/summary/SessionSummaryPage';
import DrillPage from './pages/drill/DrillPage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          background: 'var(--bg-app)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          color: 'var(--text-3)',
          fontSize: '13px',
        }}
      >
        <span className="dot dot-accent dot-pulse" />
        Loading…
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function App() {
  const { initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/overlay" element={<OverlayPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <HomePage />
            </RequireAuth>
          }
        />
        <Route
          path="/session"
          element={
            <RequireAuth>
              <SessionPage />
            </RequireAuth>
          }
        />
        <Route
          path="/history"
          element={
            <RequireAuth>
              <HistoryPage />
            </RequireAuth>
          }
        />
        <Route
          path="/drill"
          element={
            <RequireAuth>
              <DrillPage />
            </RequireAuth>
          }
        />
        <Route
          path="/session-summary/:sessionId"
          element={
            <RequireAuth>
              <SessionSummaryPage />
            </RequireAuth>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireAuth>
              <SettingsPage />
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
