import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const PASS_MINUTES_TOTAL = 120;

export interface UsageInfo {
  type: 'subscription' | 'pass';
  plan: string;
  planName: string;
  allowed: boolean;
  // Subscription fields
  used: number;
  limit: number;
  percent: number;
  resetAt: string;
  // Pass fields
  passMinutesUsed: number;
  passMinutesTotal: number;
  passExpiresAt: string | null;
}

@Injectable()
export class UsageService {
  private readonly logger = new Logger(UsageService.name);
  private supabase: SupabaseClient;

  constructor(private config: ConfigService) {
    this.supabase = createClient(
      this.config.get<string>('supabase.url')!,
      this.config.get<string>('supabase.serviceRoleKey')!,
    );
  }

  async getUsage(userId: string): Promise<UsageInfo> {
    await this.maybeReset(userId);

    const { data: profile } = await this.supabase
      .from('profiles')
      .select('plan, tokens_used, tokens_limit, usage_reset_at, pass_expires_at, pass_minutes_used')
      .eq('id', userId)
      .single();

    if (!profile) {
      return this.emptyUsage();
    }

    const { data: planRow } = await this.supabase
      .from('plans')
      .select('display_name')
      .eq('id', profile.plan ?? 'free')
      .maybeSingle();

    if (profile.plan === 'interview_pass') {
      const minutesUsed = profile.pass_minutes_used ?? 0;
      const expiresAt = profile.pass_expires_at ?? null;
      const notExpired = expiresAt ? new Date(expiresAt) > new Date() : false;
      const hasMinutes = minutesUsed < PASS_MINUTES_TOTAL;

      return {
        type: 'pass',
        plan: 'interview_pass',
        planName: planRow?.display_name ?? 'Interview Pass',
        allowed: notExpired && hasMinutes,
        used: 0,
        limit: 0,
        percent: Math.round((minutesUsed / PASS_MINUTES_TOTAL) * 100),
        resetAt: '',
        passMinutesUsed: minutesUsed,
        passMinutesTotal: PASS_MINUTES_TOTAL,
        passExpiresAt: expiresAt,
      };
    }

    const used = profile.tokens_used ?? 0;
    const limit = profile.tokens_limit ?? 0;
    const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 100;

    return {
      type: 'subscription',
      plan: profile.plan ?? 'free',
      planName: planRow?.display_name ?? 'Free',
      allowed: limit > 0 && used < limit,
      used,
      limit,
      percent,
      resetAt: profile.usage_reset_at ?? '',
      passMinutesUsed: 0,
      passMinutesTotal: PASS_MINUTES_TOTAL,
      passExpiresAt: null,
    };
  }

  /** Fast path check for WebSocket gate. */
  async checkLimit(userId: string): Promise<boolean> {
    await this.maybeReset(userId);

    const { data } = await this.supabase
      .from('profiles')
      .select('plan, tokens_used, tokens_limit, pass_expires_at, pass_minutes_used')
      .eq('id', userId)
      .single();

    if (!data) return false;

    if (data.plan === 'interview_pass') {
      const notExpired = data.pass_expires_at
        ? new Date(data.pass_expires_at) > new Date()
        : false;
      return notExpired && (data.pass_minutes_used ?? 0) < PASS_MINUTES_TOTAL;
    }

    const limit = data.tokens_limit ?? 0;
    return limit > 0 && (data.tokens_used ?? 0) < limit;
  }

  /** Atomically add tokens to monthly usage. Fire-and-forget safe. */
  async track(userId: string, tokens: number): Promise<void> {
    if (tokens <= 0) return;

    const { error } = await this.supabase.rpc('increment_tokens_used', {
      p_user_id: userId,
      p_tokens: tokens,
    });

    if (error) {
      this.logger.warn(`Failed to track ${tokens} tokens for ${userId}: ${error.message}`);
    }
  }

  /** Track Interview Pass duration after session ends. Fire-and-forget safe. */
  async trackPassUsage(userId: string, durationSecs: number): Promise<void> {
    if (durationSecs <= 0) return;

    const minutes = Math.ceil(durationSecs / 60);
    const { error } = await this.supabase.rpc('increment_pass_minutes', {
      p_user_id: userId,
      p_minutes: minutes,
    });

    if (error) {
      this.logger.warn(`Failed to track ${minutes} pass minutes for ${userId}: ${error.message}`);
    }
  }

  private async maybeReset(userId: string): Promise<void> {
    const { data } = await this.supabase
      .from('profiles')
      .select('plan, usage_reset_at')
      .eq('id', userId)
      .single();

    if (!data?.usage_reset_at || data.plan === 'interview_pass') return;

    if (new Date(data.usage_reset_at) <= new Date()) {
      const nextReset = new Date();
      nextReset.setMonth(nextReset.getMonth() + 1);
      nextReset.setDate(1);
      nextReset.setHours(0, 0, 0, 0);

      await this.supabase
        .from('profiles')
        .update({ tokens_used: 0, usage_reset_at: nextReset.toISOString() })
        .eq('id', userId);
    }
  }

  private emptyUsage(): UsageInfo {
    return {
      type: 'subscription',
      plan: 'free',
      planName: 'Free',
      allowed: false,
      used: 0,
      limit: 0,
      percent: 100,
      resetAt: '',
      passMinutesUsed: 0,
      passMinutesTotal: PASS_MINUTES_TOTAL,
      passExpiresAt: null,
    };
  }
}
