/**
 * HTTP client for the Savant NestJS backend.
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
  created_at?: string | null;
}

/** Persisted with session scorecard from transcription gateway (DevOracle). */
export type VocalCoachingScorecard = {
  avg_wpm: number;
  filler_words_total: number;
};

export function parseVocalCoachingScorecard(
  scorecard: Record<string, unknown> | null | undefined,
): VocalCoachingScorecard | null {
  if (!scorecard || typeof scorecard !== 'object') return null;
  const raw = scorecard.vocal_coaching;
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const avg = o.avg_wpm;
  const filler = o.filler_words_total;
  if (typeof avg !== 'number' || typeof filler !== 'number') return null;
  return { avg_wpm: avg, filler_words_total: filler };
}

export function listSessions(token: string, opts?: { product?: string }) {
  const qs = opts?.product
    ? `?product=${encodeURIComponent(opts.product)}`
    : '';
  return request<SessionRow[]>(`/sessions${qs}`, {}, token);
}

export function getSession(token: string, sessionId: string) {
  return request<SessionRow>(`/sessions/${sessionId}`, {}, token);
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

export type InterviewScorecard = {
  overall_score: number;
  problem_solving: number;
  code_quality: number;
  communication_clarity: number;
  time_management: number;
  questions_attempted: number;
  questions_solved: number;
  hints_used: number;
  approach_quality: 'excellent' | 'good' | 'needs_work';
  strengths: string[];
  improvements: string[];
  next_study_topics: string[];
  estimated_level: 'junior' | 'mid' | 'senior' | 'staff';
  session_summary: string;
};

export function postInterviewScorecard(
  token: string,
  sessionId: string,
  body: {
    transcript_segments: { text: string; speaker?: string; timestamp?: string }[];
    suggestions: { suggestion_type: string; content: string }[];
    mode: string;
    questions_attempted?: number;
    questions_solved?: number;
    hints_used?: number;
  },
) {
  return request<{ session: SessionRow; scorecard: InterviewScorecard }>(
    `/sessions/${sessionId}/interview-scorecard`,
    { method: 'POST', body: JSON.stringify(body) },
    token,
  );
}

export type ProblemContext = {
  title: string;
  description: string;
  difficulty: string;
  examples: string;
  constraints: string;
  sourceUrl: string;
  markdown: string;
};

export function fetchProblemByUrl(token: string, url: string) {
  const qs = `?url=${encodeURIComponent(url)}`;
  return request<ProblemContext>(`/problems/fetch${qs}`, {}, token);
}

export function postSessionProblemContext(
  token: string,
  sessionId: string,
  body: { title: string; difficulty: string; markdown: string },
) {
  return request<{ ok: boolean }>(`/sessions/${sessionId}/problem-context`, {
    method: 'POST',
    body: JSON.stringify(body),
  }, token);
}

// ── Companies (interview prep) ───────────────────────────────

export type CompanyRow = {
  id: string;
  name: string;
  slug: string;
  interview_style: string;
  common_topics: string[];
  red_flags: string[];
  system_prompt_addon: string | null;
  logo_emoji: string;
  created_at?: string;
};

export function getCompanies(token: string) {
  return request<{ items: CompanyRow[] }>(`/companies`, {}, token);
}

export function getCompanyBySlug(token: string, slug: string) {
  return request<CompanyRow>(
    `/companies/${encodeURIComponent(slug)}`,
    {},
    token,
  );
}

// ── Drills (SM-2 spaced repetition) ───────────────────────────

export type DrillCardWithQuestion = {
  id: string;
  question_id: string;
  next_review: string;
  interval_days: number;
  easiness_factor: number;
  repetitions: number;
  last_quality: number | null;
  created_at: string;
  question: {
    id: string;
    text: string;
    answer: string;
    product: string;
    mode: string;
    suggestion_type: string;
  };
};

export type DrillStats = {
  due: number;
  total: number;
  streak: number;
};

export function getDrillsDue(token: string, limit = 20) {
  return request<{ items: DrillCardWithQuestion[] }>(
    `/drills/due?limit=${limit}`,
    {},
    token,
  );
}

export function getDrillsAhead(token: string, limit = 20) {
  return request<{ items: DrillCardWithQuestion[] }>(
    `/drills/ahead?limit=${limit}`,
    {},
    token,
  );
}

export function getDrillsStats(token: string) {
  return request<DrillStats>(`/drills/stats`, {}, token);
}

export function postDrillReview(
  token: string,
  cardId: string,
  body: { quality: 0 | 1 | 2 | 3 | 4 | 5 },
) {
  return request<DrillCardWithQuestion>(`/drills/cards/${cardId}/review`, {
    method: 'POST',
    body: JSON.stringify(body),
  }, token);
}

export function postDrillCard(token: string, questionId: string) {
  return request<DrillCardWithQuestion>(`/drills/cards`, {
    method: 'POST',
    body: JSON.stringify({ question_id: questionId }),
  }, token);
}

// ── Question Bank ─────────────────────────────────────────────

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
