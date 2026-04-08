import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { FollowUpEmailPayload, Session } from './sessions.entity';
import type { CreateSessionDto } from './dto/create-session.dto';
import type { EndSessionDto } from './dto/end-session.dto';

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
    const { data, error } = await this.supabase
      .from('sessions')
      .insert({
        user_id: userId,
        product: dto.product,
        mode: dto.mode,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Session;
  }

  async end(
    sessionId: string,
    userId: string,
    summary: EndSessionDto,
  ): Promise<Session> {
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
    return data as Session;
  }

  async findByUser(userId: string, product?: string): Promise<Session[]> {
    let query = this.supabase
      .from('sessions')
      .select('*')
      .eq('user_id', userId);
    if (product) {
      query = query.eq('product', product);
    }
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
}
