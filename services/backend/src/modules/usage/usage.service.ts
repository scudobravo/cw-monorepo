import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface UsageInfo {
  used: number;
  limit: number;
  percent: number;
  plan: string;
  planName: string;
  resetAt: string;
  allowed: boolean;
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

  /** Returns usage info for the given user. Performs lazy monthly reset if needed. */
  async getUsage(userId: string): Promise<UsageInfo> {
    await this.maybeReset(userId);

    const { data: profile } = await this.supabase
      .from('profiles')
      .select('plan, tokens_used, tokens_limit, usage_reset_at')
      .eq('id', userId)
      .single();

    if (!profile) {
      return { used: 0, limit: 150000, percent: 0, plan: 'free', planName: 'Free', resetAt: '', allowed: true };
    }

    const { data: planRow } = await this.supabase
      .from('plans')
      .select('display_name')
      .eq('id', profile.plan ?? 'free')
      .maybeSingle();

    const used = profile.tokens_used ?? 0;
    const limit = profile.tokens_limit ?? 150000;
    const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

    return {
      used,
      limit,
      percent,
      plan: profile.plan ?? 'free',
      planName: planRow?.display_name ?? 'Free',
      resetAt: profile.usage_reset_at ?? '',
      allowed: used < limit,
    };
  }

  /** Check limit only — fast path for WebSocket connection gate. */
  async checkLimit(userId: string): Promise<boolean> {
    await this.maybeReset(userId);

    const { data } = await this.supabase
      .from('profiles')
      .select('tokens_used, tokens_limit')
      .eq('id', userId)
      .single();

    if (!data) return true; // profile not found → let it through
    return (data.tokens_used ?? 0) < (data.tokens_limit ?? 150000);
  }

  /** Atomically add tokens to the user's monthly usage. Fire-and-forget safe. */
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

  /** Lazy monthly reset: if reset_at is in the past, zero out tokens_used. */
  private async maybeReset(userId: string): Promise<void> {
    const { data } = await this.supabase
      .from('profiles')
      .select('usage_reset_at')
      .eq('id', userId)
      .single();

    if (!data?.usage_reset_at) return;

    const resetAt = new Date(data.usage_reset_at);
    if (resetAt <= new Date()) {
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
}
