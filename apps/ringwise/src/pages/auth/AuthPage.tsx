import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Loader2, Radio } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

type Mode = 'sign_in' | 'sign_up';

export default function AuthPage() {
  const navigate = useNavigate();
  const { signIn, signUp, user, isLoading, error, clearError } = useAuthStore();

  const [mode, setMode] = useState<Mode>('sign_in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signUpDone, setSignUpDone] = useState(false);

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (mode === 'sign_in') {
      await signIn(email, password);
    } else {
      await signUp(email, password);
      setSignUpDone(true);
    }
  };

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: 'var(--bg-app)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div className="fade-in" style={{ width: '100%', maxWidth: '360px', padding: '0 20px' }}>
        {/* Logo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '32px',
            justifyContent: 'center',
          }}
        >
          <div className="logo-mark">
            <Radio size={12} />
          </div>
          <span
            style={{
              fontFamily: 'var(--font)',
              fontSize: '18px',
              fontWeight: 700,
              color: 'var(--text-1)',
              letterSpacing: '-0.4px',
            }}
          >
            RingWise
          </span>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ marginBottom: '20px', textAlign: 'center' }}>
            <div className="page-title" style={{ fontSize: '16px' }}>
              {mode === 'sign_in' ? 'Welcome back' : 'Create account'}
            </div>
            <div className="page-subtitle" style={{ marginTop: '4px' }}>
              {mode === 'sign_in'
                ? 'Sign in to your RingWise account'
                : 'Start closing more deals with RingWise'}
            </div>
          </div>

          {signUpDone && mode === 'sign_up' && (
            <div
              style={{
                padding: '10px 14px',
                background: 'var(--accent-dim)',
                border: '1px solid var(--accent-border)',
                borderRadius: 'var(--r-md)',
                color: 'var(--accent-light)',
                fontSize: '12px',
                marginBottom: '16px',
              }}
            >
              Check your email to confirm your account, then sign in.
            </div>
          )}

          {error && (
            <div
              style={{
                padding: '10px 14px',
                background: 'var(--red-dim)',
                border: '1px solid rgba(239,68,68,0.22)',
                borderRadius: 'var(--r-md)',
                color: 'var(--red)',
                fontSize: '12px',
                marginBottom: '16px',
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label">Email</label>
              <div style={{ position: 'relative' }}>
                <Mail
                  size={14}
                  style={{
                    position: 'absolute',
                    left: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-3)',
                    pointerEvents: 'none',
                  }}
                />
                <input
                  className="input"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{ paddingLeft: '32px' }}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={14}
                  style={{
                    position: 'absolute',
                    left: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-3)',
                    pointerEvents: 'none',
                  }}
                />
                <input
                  className="input"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{ paddingLeft: '32px' }}
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-full" disabled={isLoading}>
              {isLoading ? (
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
              ) : null}
              {mode === 'sign_in' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <div
            style={{
              marginTop: '16px',
              textAlign: 'center',
              fontSize: '12px',
              color: 'var(--text-3)',
            }}
          >
            {mode === 'sign_in' ? (
              <>
                Don't have an account?{' '}
                <button
                  className="btn-ghost"
                  style={{ color: 'var(--accent-light)', fontSize: '12px', padding: 0 }}
                  onClick={() => { setMode('sign_up'); clearError(); }}
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  className="btn-ghost"
                  style={{ color: 'var(--accent-light)', fontSize: '12px', padding: 0 }}
                  onClick={() => { setMode('sign_in'); clearError(); setSignUpDone(false); }}
                >
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
