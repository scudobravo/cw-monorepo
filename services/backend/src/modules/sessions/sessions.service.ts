import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { FollowUpEmailPayload, Session } from './sessions.entity';
import type { CreateSessionDto } from './dto/create-session.dto';
import type { EndSessionDto } from './dto/end-session.dto';

const PASS_MINUTES_TOTAL = 120;

@Injectable()
export class SessionsService {
  private supabase: SupabaseClient;

  constructor(private config: ConfigService) {
    this.supabase = createClient(
      this.config.get<string>('supabase.url')!,
      this.config.get<string>('supabase.serviceRoleKey')!,
    );
  }

  async create(userId: string, dto: CreateSessionDto): Promise<Session> {
    // Validate access before creating the session record
    await this.assertCanStart(userId);

    const { data, error } = await this.supabase
      .from('sessions')
      .insert({ user_id: userId, product: dto.product, mode: dto.mode })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Session;
  }

  async end(sessionId: string, userId: string, summary: EndSessionDto): Promise<Session> {
    const { data, error } = await this.supabase
      .from('sessions')
      .update({
        ended_at: new Date().toISOString(),
        duration_secs: summary.duration_secs ?? null,
        total_suggestions: summary.total_suggestions ?? null,
        talk_ratio_user: summary.talk_ratio_user ?? null,
        recap: summary.recap ?? null,
        scorecard: summary.scorecard ?? null,
      })
      .eq('id', sessionId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new NotFoundException('Session not found');

    // Track Interview Pass minutes after session ends
    if (summary.duration_secs && summary.duration_secs > 0) {
      await this.maybeTrackPassUsage(userId, summary.duration_secs);
    }

    return data as Session;
  }

  async findByUser(userId: string, product?: string): Promise<Session[]> {
    let query = this.supabase.from('sessions').select('*').eq('user_id', userId);
    if (product) query = query.eq('product', product);
    const { data, error } = await query.order('started_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Session[];
  }

  async findOne(sessionId: string, userId: string): Promise<Session> {
    const { data, error } = await this.supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();
    if (error || !data) throw new NotFoundException('Session not found');
    return data as Session;
  }

  async updateScorecard(
    sessionId: string,
    userId: string,
    scorecard: Record<string, unknown>,
  ): Promise<Session> {
    const { data, error } = await this.supabase
      .from('sessions')
      .update({ scorecard })
      .eq('id', sessionId)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new NotFoundException('Session not found');
    return data as Session;
  }

  async updateFollowUpEmail(
    sessionId: string,
    userId: string,
    payload: FollowUpEmailPayload,
  ): Promise<Session> {
    const row = {
      follow_up_email: {
        ...payload,
        generated_at: payload.generated_at ?? new Date().toISOString(),
      },
    };
    const { data, error } = await this.supabase
      .from('sessions')
      .update(row)
      .eq('id', sessionId)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new NotFoundException('Session not found');
    return data as Session;
  }

  // ── Private helpers ───────────────────────────────────────────

  private async assertCanStart(userId: string): Promise<void> {
    const { data: profile } = await this.supabase
      .from('profiles')
      .select('plan, tokens_used, tokens_limit, pass_expires_at, pass_minutes_used, subscription_status')
      .eq('id', userId)
      .single();

    if (!profile) {
      throw new ForbiddenException('No active subscription found.');
    }

    if (profile.plan === 'interview_pass') {
      const expired = !profile.pass_expires_at || new Date(profile.pass_expires_at) <= new Date();
      const exhausted = (profile.pass_minutes_used ?? 0) >= PASS_MINUTES_TOTAL;

      if (expired) {
        throw new ForbiddenException(
          'Your Interview Pass has expired. Purchase a new pass at devoracle.com.',
        );
      }
      if (exhausted) {
        throw new ForbiddenException(
          'Your Interview Pass (2h) has been fully used. Purchase a new pass at devoracle.com.',
        );
      }
      return;
    }

    // Subscription plans: check token limit
    const limit = profile.tokens_limit ?? 0;
    const used = profile.tokens_used ?? 0;
    if (limit === 0 || used >= limit) {
      throw new ForbiddenException(
        'Usage limit reached. Please upgrade your plan or wait for your monthly reset.',
      );
    }
  }

  private async maybeTrackPassUsage(userId: string, durationSecs: number): Promise<void> {
    const { data: profile } = await this.supabase
      .from('profiles')
      .select('plan')
      .eq('id', userId)
      .single();

    if (profile?.plan !== 'interview_pass') return;

    const minutes = Math.ceil(durationSecs / 60);
    await this.supabase.rpc('increment_pass_minutes', {
      p_user_id: userId,
      p_minutes: minutes,
    });
  }
}
