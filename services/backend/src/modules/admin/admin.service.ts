import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
type StripeClient = InstanceType<typeof Stripe>;

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  private supabase: SupabaseClient;
  private stripe: StripeClient | null = null;

  constructor(private config: ConfigService) {
    this.supabase = createClient(
      this.config.get<string>('supabase.url')!,
      this.config.get<string>('supabase.serviceRoleKey')!,
    );

    const stripeKey = this.config.get<string>('stripe.secretKey');
    if (stripeKey) {
      this.stripe = new Stripe(stripeKey);
    }
  }

  // ── Stats ────────────────────────────────────────────────────

  async getStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const startOfDay = new Date(now);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const [
      { count: total_users },
      { count: active_sessions },
      { count: sessions_today },
      { count: new_users_month },
      { data: profiles },
      { data: questions },
      { data: endedSessions },
      { data: tokenStats },
    ] = await Promise.all([
      this.supabase.from('profiles').select('*', { count: 'exact', head: true }),
      this.supabase.from('sessions').select('*', { count: 'exact', head: true }).is('ended_at', null),
      this.supabase.from('sessions').select('*', { count: 'exact', head: true }).gte('started_at', startOfDay.toISOString()),
      this.supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', startOfMonth),
      this.supabase.from('profiles').select('plan, product, tokens_used'),
      this.supabase.from('questions').select('asked_count'),
      this.supabase.from('sessions').select('total_suggestions').not('ended_at', 'is', null),
      this.supabase.from('profiles').select('tokens_used'),
    ]);

    // MRR by plan (€) — interview_pass is one-time, excluded from MRR
    const planPriceEur: Record<string, number> = {
      free: 0,
      pro: 17,
      ringwise_pro: 29,
      ringwise_team: 69,
      interview_pass: 0,
    };
    let mrr_eur = 0;
    const users_by_plan: Record<string, number> = { free: 0, pro: 0, team: 0 };
    const users_by_product: Record<string, number> = { DevOracle: 0, RingWise: 0 };

    for (const p of profiles ?? []) {
      mrr_eur += planPriceEur[p.plan] ?? 0;
      users_by_plan[p.plan] = (users_by_plan[p.plan] ?? 0) + 1;
      if (p.product) users_by_product[p.product] = (users_by_product[p.product] ?? 0) + 1;
    }

    const total_tokens_used_month = (tokenStats ?? []).reduce(
      (s, r) => s + (r.tokens_used ?? 0), 0,
    );

    const question_bank_hits = (questions ?? []).reduce(
      (s, q) => s + (q.asked_count ?? 0), 0,
    );
    const sessions_total_suggestions = (endedSessions ?? []).reduce(
      (s, r) => s + (r.total_suggestions ?? 0), 0,
    );
    const denom = question_bank_hits + Math.max(1, sessions_total_suggestions);
    const cache_hit_rate = Math.min(1, question_bank_hits / denom);

    return {
      total_users: total_users ?? 0,
      new_users_month: new_users_month ?? 0,
      active_sessions: active_sessions ?? 0,
      sessions_today: sessions_today ?? 0,
      mrr_eur,
      users_by_plan,
      users_by_product,
      total_tokens_used_month,
      cache_hit_rate: Math.round(cache_hit_rate * 100),
      question_bank_hits,
    };
  }

  // ── Users ────────────────────────────────────────────────────

  async listUsers(opts: { product?: string; plan?: string; search?: string; page?: number; limit?: number }) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, opts.limit ?? 25);
    const from = (page - 1) * limit;

    let query = this.supabase
      .from('profiles')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + limit - 1);

    if (opts.search) query = query.ilike('email', `%${opts.search}%`);
    if (opts.plan) query = query.eq('plan', opts.plan);
    if (opts.product) query = query.eq('product', opts.product);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    // session counts
    const { data: allSessions } = await this.supabase.from('sessions').select('user_id');
    const sessionCounts = new Map<string, number>();
    for (const s of allSessions ?? []) {
      sessionCounts.set(s.user_id, (sessionCounts.get(s.user_id) ?? 0) + 1);
    }

    return {
      items: (data ?? []).map((p) => ({
        ...p,
        session_count: sessionCounts.get(p.id) ?? 0,
        usage_percent: p.tokens_limit > 0
          ? Math.min(100, Math.round((p.tokens_used / p.tokens_limit) * 100))
          : 0,
      })),
      total: count ?? 0,
      page,
      limit,
    };
  }

  async getUser(id: string) {
    const { data: profile, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !profile) throw new NotFoundException('User not found');

    // recent sessions
    const { data: sessions } = await this.supabase
      .from('sessions')
      .select('id, product, mode, started_at, ended_at, duration_secs, total_suggestions')
      .eq('user_id', id)
      .order('started_at', { ascending: false })
      .limit(10);

    // Stripe subscription detail
    let stripeSubscription = null;
    if (this.stripe && profile.stripe_subscription_id) {
      try {
        const sub = await this.stripe.subscriptions.retrieve(profile.stripe_subscription_id);
        stripeSubscription = {
          status: sub.status,
          current_period_end: new Date((sub as any).current_period_end * 1000).toISOString(),
          cancel_at_period_end: sub.cancel_at_period_end,
        };
      } catch {
        this.logger.warn(`Could not retrieve Stripe sub for ${id}`);
      }
    }

    return {
      ...profile,
      usage_percent: profile.tokens_limit > 0
        ? Math.min(100, Math.round((profile.tokens_used / profile.tokens_limit) * 100))
        : 0,
      recent_sessions: sessions ?? [],
      stripe_subscription: stripeSubscription,
    };
  }

  async updateUserPlan(id: string, plan: 'free' | 'pro' | 'team') {
    // Updating plan triggers DB trigger → tokens_limit + tokens_used reset automatically
    const { data, error } = await this.supabase
      .from('profiles')
      .update({ plan })
      .eq('id', id)
      .select('id, email, plan, tokens_limit, tokens_used')
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async updateUserTokens(id: string, tokens_limit: number) {
    const { data, error } = await this.supabase
      .from('profiles')
      .update({ tokens_limit })
      .eq('id', id)
      .select('id, email, plan, tokens_limit, tokens_used')
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async resetUserUsage(id: string) {
    const nextReset = new Date();
    nextReset.setMonth(nextReset.getMonth() + 1);
    nextReset.setDate(1);
    nextReset.setHours(0, 0, 0, 0);

    const { data, error } = await this.supabase
      .from('profiles')
      .update({ tokens_used: 0, usage_reset_at: nextReset.toISOString() })
      .eq('id', id)
      .select('id, email, tokens_used, usage_reset_at')
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async cancelUserSubscription(id: string) {
    const { data: profile } = await this.supabase
      .from('profiles')
      .select('stripe_subscription_id, email')
      .eq('id', id)
      .single();

    if (!profile) throw new NotFoundException('User not found');
    if (!profile.stripe_subscription_id) {
      throw new BadRequestException('User has no active Stripe subscription');
    }
    if (!this.stripe) {
      throw new BadRequestException('Stripe not configured on this server');
    }

    // Cancel immediately on Stripe
    await this.stripe.subscriptions.cancel(profile.stripe_subscription_id);

    // Downgrade to free in DB
    const { data } = await this.supabase
      .from('profiles')
      .update({
        plan: 'free',
        tokens_limit: 150000,
        tokens_used: 0,
        subscription_status: 'cancelled',
        stripe_subscription_id: null,
      })
      .eq('id', id)
      .select('id, email, plan')
      .single();

    this.logger.log(`Admin cancelled subscription for user ${profile.email}`);
    return { ok: true, user: data };
  }

  // ── Plans ────────────────────────────────────────────────────

  async listPlans() {
    const { data, error } = await this.supabase
      .from('plans')
      .select('*')
      .order('price_eur', { ascending: true });

    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async updatePlan(id: string, dto: { tokens_monthly?: number; price_eur?: number; display_name?: string }) {
    const updates: Record<string, unknown> = {};
    if (dto.tokens_monthly !== undefined) updates['tokens_monthly'] = dto.tokens_monthly;
    if (dto.price_eur !== undefined) updates['price_eur'] = dto.price_eur;
    if (dto.display_name !== undefined) updates['display_name'] = dto.display_name;

    const { data, error } = await this.supabase
      .from('plans')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    // If tokens_monthly changed, update all users on this plan who haven't been overridden
    if (dto.tokens_monthly !== undefined) {
      await this.supabase
        .from('profiles')
        .update({ tokens_limit: dto.tokens_monthly })
        .eq('plan', id);
      this.logger.log(`Updated tokens_limit to ${dto.tokens_monthly} for all ${id} plan users`);
    }

    return data;
  }

  // ── Sessions ─────────────────────────────────────────────────

  async listSessions(opts: { page: number; limit: number; product?: string; mode?: string }) {
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

    return { items: data ?? [], total: count ?? 0, page: opts.page, limit: opts.limit };
  }

  // ── Question Bank ─────────────────────────────────────────────

  async listQuestionBank() {
    const { data, error } = await this.supabase
      .from('questions')
      .select('id, product, mode, text, answer, suggestion_type, asked_count, created_at, embedding')
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
      .from('questions').select('*').eq('id', id).single();

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
