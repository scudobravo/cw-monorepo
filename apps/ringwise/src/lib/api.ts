/**
 * HTTP client for the RingWise NestJS backend.
 * All requests are authenticated with the Supabase JWT stored in authStore.
 */

const BASE_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3000';

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}/api${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

// ── Auth ──────────────────────────────────────────────────────

export function verifyToken(token: string) {
  return request<{ valid: boolean; userId?: string; email?: string }>(
    '/auth/verify',
    { method: 'POST', body: JSON.stringify({ token }) },
  );
}

export function getMe(token: string) {
  return request<{ user: unknown; profile: unknown }>('/auth/me', {}, token);
}

// ── Sessions ──────────────────────────────────────────────────

export interface FollowUpEmailPayload {
  subject: string;
  body: string;
  generated_at?: string;
}

export interface SessionRow {
  id: string;
  user_id: string;
  product: 'DevOracle' | 'RingWise';
  mode: string;
  started_at: string;
  ended_at: string | null;
  duration_secs: number | null;
  total_suggestions: number | null;
  talk_ratio_user: number | null;
  recap: string | null;
  scorecard: Record<string, unknown> | null;
  follow_up_email?: FollowUpEmailPayload | null;
  created_at?: string | null;
}

export function listSessions(token: string, opts?: { product?: string }) {
  const qs = opts?.product
    ? `?product=${encodeURIComponent(opts.product)}`
    : '';
  return request<SessionRow[]>(`/sessions${qs}`, {}, token);
}

export function patchSessionEnd(
  token: string,
  sessionId: string,
  body: {
    duration_secs?: number;
    total_suggestions?: number;
    talk_ratio_user?: number;
    recap?: string;
    scorecard?: Record<string, unknown>;
  },
) {
  return request<SessionRow>(`/sessions/${sessionId}/end`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  }, token);
}

export type CallScorecard = {
  overall_score: number;
  talk_ratio_score: number;
  objections_handled: number;
  objections_total: number;
  buying_signals_detected: number;
  next_step_established: boolean;
  strengths: string[];
  improvements: string[];
  recommended_action: string;
  call_summary: string;
};

export function getSession(token: string, sessionId: string) {
  return request<SessionRow>(`/sessions/${sessionId}`, {}, token);
}

export function postSessionScorecard(
  token: string,
  sessionId: string,
  body: {
    transcript_segments: { text: string; speaker?: string; timestamp?: string }[];
    suggestions: { suggestion_type: string; content: string }[];
    talk_ratio_user: number;
    mode: string;
  },
) {
  return request<{ session: SessionRow; scorecard: CallScorecard }>(
    `/sessions/${sessionId}/scorecard`,
    { method: 'POST', body: JSON.stringify(body) },
    token,
  );
}

export function postFollowUpEmail(
  token: string,
  sessionId: string,
  body?: { transcript_segments?: { text: string; speaker?: string }[] },
) {
  return request<{ subject: string; body: string }>(
    `/sessions/${sessionId}/follow-up-email`,
    { method: 'POST', body: JSON.stringify(body ?? {}) },
    token,
  );
}

// ── Question Bank (Cue uses product=RingWise) ───────────────

export function getTopQuestions(
  token: string,
  opts: { product?: string; mode?: string; limit?: number } = {},
) {
  const params = new URLSearchParams();
  if (opts.product) params.set('product', opts.product);
  if (opts.mode) params.set('mode', opts.mode);
  if (opts.limit) params.set('limit', String(opts.limit));

  const qs = params.toString();
  return request<unknown[]>(`/question-bank/top${qs ? `?${qs}` : ''}`, {}, token);
}

// ── WebSocket URL ─────────────────────────────────────────────

export function transcriptionWsUrl(): string {
  const base = BASE_URL.replace(/^http/, 'ws');
  return `${base}/transcription`;
}
