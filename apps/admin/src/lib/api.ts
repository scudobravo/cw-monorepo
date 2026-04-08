const base = () =>
  import.meta.env.DEV ? "" : `${window.location.origin}`;

export async function adminFetch<T>(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${base()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers as Record<string, string>),
    },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`${res.status}: ${t}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export type AdminStats = {
  total_users: number;
  active_sessions: number;
  mrr_estimate: number;
  sessions_today: number;
  cache_hit_rate: number;
  question_bank_total_hits: number;
  sessions_total_cues: number;
};

export type AdminUser = {
  id: string;
  email: string;
  plan: string;
  last_seen: string;
  session_count: number;
  created_at: string;
};

export type AdminSessionRow = {
  id: string;
  user_id: string;
  product: string;
  mode: string;
  started_at: string;
  ended_at: string | null;
  duration_secs: number | null;
  total_suggestions: number | null;
};

export type AdminSessionsResponse = {
  items: AdminSessionRow[];
  total: number;
  page: number;
  limit: number;
};

export type AdminQuestionList = {
  id: string;
  product: string;
  mode: string;
  text: string;
  suggestion_type: string;
  asked_count: number;
  created_at: string;
  has_embedding: boolean;
  embedding_dimensions: number;
};

export type AdminQuestionDetail = {
  id: string;
  product: string;
  mode: string;
  text: string;
  answer: string;
  suggestion_type: string;
  asked_count: number;
  created_at: string;
  updated_at?: string;
  has_embedding: boolean;
  embedding_dimensions: number;
};

export type AdminCompetitor = {
  id: string;
  name: string;
  aliases: string[] | null;
  win_points: string[] | null;
  lose_points: string[] | null;
  positioning: string;
  trap_questions: string[] | null;
  product: string;
  created_at?: string | null;
};

export type UpsertCompetitorBody = {
  id?: string;
  name: string;
  aliases?: string[];
  win_points?: string[];
  lose_points?: string[];
  positioning: string;
  trap_questions?: string[];
  product: "RingWise" | "DevOracle";
};

export function listCompetitors(token: string, product?: string) {
  const q = product
    ? `?product=${encodeURIComponent(product)}`
    : "";
  return adminFetch<AdminCompetitor[]>(`/admin/api/competitors${q}`, token);
}

export function upsertCompetitor(token: string, body: UpsertCompetitorBody) {
  return adminFetch<AdminCompetitor>(`/admin/api/competitors`, token, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
