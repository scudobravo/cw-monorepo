import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const PLAN_MRR_USD: Record<string, number> = {
  free: 0,
  pro: 29,
  team: 99,
};

@Injectable()
export class AdminService {
  private supabase: SupabaseClient;

  constructor(private config: ConfigService) {
    this.supabase = createClient(
      this.config.get<string>('supabase.url')!,
      this.config.get<string>('supabase.serviceRoleKey')!,
    );
  }

  async getStats() {
    const { count: total_users } = await this.supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    const { count: active_sessions } = await this.supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .is('ended_at', null);

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const { count: sessions_today } = await this.supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .gte('started_at', startOfDay.toISOString());

    const { data: profiles } = await this.supabase.from('profiles').select('plan');
    let mrr_estimate = 0;
    for (const p of profiles ?? []) {
      mrr_estimate += PLAN_MRR_USD[p.plan] ?? 0;
    }

    const { data: questions } = await this.supabase
      .from('questions')
      .select('asked_count');
    const question_bank_hits = (questions ?? []).reduce(
      (s, q) => s + (q.asked_count ?? 0),
      0,
    );

    const { data: endedSessions } = await this.supabase
      .from('sessions')
      .select('total_suggestions')
      .not('ended_at', 'is', null);
    const sessions_total_cues = (endedSessions ?? []).reduce(
      (s, row) => s + (row.total_suggestions ?? 0),
      0,
    );

    const denom = question_bank_hits + Math.max(1, sessions_total_cues);
    const cache_hit_rate = Math.min(1, question_bank_hits / denom);

    return {
      total_users: total_users ?? 0,
      active_sessions: active_sessions ?? 0,
      mrr_estimate,
      sessions_today: sessions_today ?? 0,
      cache_hit_rate,
      question_bank_total_hits: question_bank_hits,
      sessions_total_cues,
    };
  }

  async listUsers(opts: { product?: string; search?: string }) {
    let query = this.supabase.from('profiles').select('*').order('created_at', {
      ascending: false,
    });

    if (opts.search) {
      query = query.ilike('email', `%${opts.search}%`);
    }

    const { data: profiles, error } = await query;
    if (error) throw new Error(error.message);

    let list = profiles ?? [];

    if (opts.product) {
      const { data: sess } = await this.supabase
        .from('sessions')
        .select('user_id')
        .eq('product', opts.product);
      const ids = new Set((sess ?? []).map((s) => s.user_id));
      list = list.filter((p) => ids.has(p.id));
    }

    const { data: allSessions } = await this.supabase
      .from('sessions')
      .select('user_id');
    const counts = new Map<string, number>();
    for (const s of allSessions ?? []) {
      counts.set(s.user_id, (counts.get(s.user_id) ?? 0) + 1);
    }

    return list.map((p) => ({
      id: p.id,
      email: p.email,
      plan: p.plan,
      last_seen: p.updated_at ?? p.created_at,
      session_count: counts.get(p.id) ?? 0,
      created_at: p.created_at,
    }));
  }

  async listSessions(opts: {
    page: number;
    limit: number;
    product?: string;
    mode?: string;
  }) {
    const from = (opts.page - 1) * opts.limit;
    const to = from + opts.limit - 1;

    let query = this.supabase
      .from('sessions')
      .select('*', { count: 'exact' })
      .order('started_at', { ascending: false })
      .range(from, to);

    if (opts.product) query = query.eq('product', opts.product);
    if (opts.mode) query = query.eq('mode', opts.mode);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    return {
      items: data ?? [],
      total: count ?? 0,
      page: opts.page,
      limit: opts.limit,
    };
  }

  async listQuestionBank() {
    const { data, error } = await this.supabase
      .from('questions')
      .select(
        'id, product, mode, text, answer, suggestion_type, asked_count, created_at, embedding',
      )
      .order('asked_count', { ascending: false });

    if (error) throw new Error(error.message);

    return (data ?? []).map((row: Record<string, unknown>) => {
      const emb = row['embedding'] as number[] | null | undefined;
      return {
        id: row['id'],
        product: row['product'],
        mode: row['mode'],
        text: row['text'],
        suggestion_type: row['suggestion_type'],
        asked_count: row['asked_count'],
        created_at: row['created_at'],
        has_embedding: Array.isArray(emb) && emb.length > 0,
        embedding_dimensions: Array.isArray(emb) ? emb.length : 0,
      };
    });
  }

  async getQuestion(id: string) {
    const { data, error } = await this.supabase
      .from('questions')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundException('Question not found');

    const raw = data.embedding as unknown;
    const emb = Array.isArray(raw) ? raw : null;
    const { embedding: _e, ...rest } = data as Record<string, unknown>;
    void _e;
    return {
      ...rest,
      has_embedding: Array.isArray(emb) && emb.length > 0,
      embedding_dimensions: Array.isArray(emb) ? emb.length : 0,
    };
  }

  async deleteQuestion(id: string) {
    const { error } = await this.supabase.from('questions').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return { ok: true };
  }
}
