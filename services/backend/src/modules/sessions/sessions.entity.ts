/** DB product names (persisted in Supabase) */
export type SessionProduct = 'DevOracle' | 'RingWise';

/** Row shape for `public.sessions` */
export interface Session {
  id: string;
  user_id: string;
  product: SessionProduct;
  mode: string;
  started_at: string;
  ended_at: string | null;
  duration_secs: number | null;
  total_suggestions: number | null;
  talk_ratio_user: number | null;
  recap: string | null;
  scorecard: Record<string, unknown> | null;
  follow_up_email: FollowUpEmailPayload | null;
  created_at: string | null;
}

export interface FollowUpEmailPayload {
  subject: string;
  body: string;
  generated_at?: string;
}
