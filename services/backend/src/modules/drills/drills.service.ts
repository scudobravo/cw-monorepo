import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { sm2, type Sm2Quality } from './sm2';

export interface DrillCardRow {
  id: string;
  user_id: string;
  question_id: string;
  next_review: string;
  interval_days: number;
  easiness_factor: number;
  repetitions: number;
  last_quality: number | null;
  created_at: string;
}

export interface QuestionSnippet {
  id: string;
  text: string;
  answer: string;
  product: string;
  mode: string;
  suggestion_type: string;
}

export interface DrillCardWithQuestion extends DrillCardRow {
  question: QuestionSnippet;
}

@Injectable()
export class DrillsService {
  private readonly logger = new Logger(DrillsService.name);
  private supabase: SupabaseClient;

  constructor(private config: ConfigService) {
    this.supabase = createClient(
      this.config.get<string>('supabase.url')!,
      this.config.get<string>('supabase.serviceRoleKey')!,
    );
  }

  private utcTodayIsoDate(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private utcYesterdayIsoDate(): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  private async attachQuestions(
    cards: DrillCardRow[],
  ): Promise<DrillCardWithQuestion[]> {
    if (cards.length === 0) return [];
    const ids = [...new Set(cards.map((c) => c.question_id))];
    const { data: questions, error } = await this.supabase
      .from('questions')
      .select('id, text, answer, mode, product, suggestion_type')
      .in('id', ids);
    if (error) throw new Error(error.message);
    const map = new Map((questions ?? []).map((q) => [q.id, q as QuestionSnippet]));
    return cards.map((c) => {
      const q = map.get(c.question_id);
      if (!q) {
        this.logger.warn(`Missing question ${c.question_id} for drill card ${c.id}`);
        throw new Error(`Question ${c.question_id} not found`);
      }
      return { ...c, question: q };
    });
  }

  async getDueCards(
    userId: string,
    limit = 10,
  ): Promise<DrillCardWithQuestion[]> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from('drill_cards')
      .select('*')
      .eq('user_id', userId)
      .lte('next_review', now)
      .order('next_review', { ascending: true })
      .limit(limit);
    if (error) throw new Error(error.message);
    return this.attachQuestions((data ?? []) as DrillCardRow[]);
  }

  /** Cards not yet due — earliest next_review first (study ahead). */
  async getAheadCards(
    userId: string,
    limit = 10,
  ): Promise<DrillCardWithQuestion[]> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from('drill_cards')
      .select('*')
      .eq('user_id', userId)
      .gt('next_review', now)
      .order('next_review', { ascending: true })
      .limit(limit);
    if (error) throw new Error(error.message);
    return this.attachQuestions((data ?? []) as DrillCardRow[]);
  }

  async reviewCard(
    userId: string,
    cardId: string,
    quality: Sm2Quality,
  ): Promise<DrillCardWithQuestion> {
    const { data: row, error: fetchErr } = await this.supabase
      .from('drill_cards')
      .select('*')
      .eq('id', cardId)
      .eq('user_id', userId)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!row) throw new NotFoundException('Drill card not found');

    const card = row as DrillCardRow;
    const updated = sm2(
      {
        interval_days: card.interval_days,
        easiness_factor: Number(card.easiness_factor),
        repetitions: card.repetitions,
      },
      quality,
    );

    const { data: saved, error: saveErr } = await this.supabase
      .from('drill_cards')
      .update({
        next_review: updated.next_review.toISOString(),
        interval_days: updated.interval_days,
        easiness_factor: updated.easiness_factor,
        repetitions: updated.repetitions,
        last_quality: updated.last_quality,
      })
      .eq('id', cardId)
      .eq('user_id', userId)
      .select()
      .single();
    if (saveErr) throw new Error(saveErr.message);

    await this.bumpStreak(userId);

    const [withQ] = await this.attachQuestions([saved as DrillCardRow]);
    return withQ;
  }

  private async bumpStreak(userId: string): Promise<void> {
    const today = this.utcTodayIsoDate();
    const yesterday = this.utcYesterdayIsoDate();

    const { data: stats, error: stErr } = await this.supabase
      .from('drill_user_stats')
      .select('streak_days, last_activity_date')
      .eq('user_id', userId)
      .maybeSingle();
    if (stErr) throw new Error(stErr.message);

    let streak_days = 1;
    const last = stats?.last_activity_date as string | null | undefined;

    if (!last) {
      streak_days = 1;
    } else if (last === today) {
      streak_days = Number(stats?.streak_days ?? 1);
    } else if (last === yesterday) {
      streak_days = Number(stats?.streak_days ?? 0) + 1;
    } else {
      streak_days = 1;
    }

    const { error: upErr } = await this.supabase.from('drill_user_stats').upsert(
      {
        user_id: userId,
        streak_days,
        last_activity_date: today,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
    if (upErr) throw new Error(upErr.message);
  }

  async addCard(userId: string, questionId: string): Promise<DrillCardWithQuestion> {
    const { data: q, error: qErr } = await this.supabase
      .from('questions')
      .select('id')
      .eq('id', questionId)
      .maybeSingle();
    if (qErr) throw new Error(qErr.message);
    if (!q) throw new NotFoundException('Question not found');

    const { data: inserted, error: insErr } = await this.supabase
      .from('drill_cards')
      .insert({
        user_id: userId,
        question_id: questionId,
        next_review: new Date().toISOString(),
        interval_days: 1,
        easiness_factor: 2.5,
        repetitions: 0,
      })
      .select()
      .single();

    if (insErr) {
      if (insErr.code === '23505') {
        throw new ConflictException('Question already in your deck');
      }
      throw new Error(insErr.message);
    }

    const [withQ] = await this.attachQuestions([inserted as DrillCardRow]);
    return withQ;
  }

  async getStats(userId: string): Promise<{
    due: number;
    total: number;
    streak: number;
  }> {
    const now = new Date().toISOString();

    const { count: due, error: e1 } = await this.supabase
      .from('drill_cards')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .lte('next_review', now);
    if (e1) throw new Error(e1.message);

    const { count: total, error: e2 } = await this.supabase
      .from('drill_cards')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    if (e2) throw new Error(e2.message);

    const { data: st, error: e3 } = await this.supabase
      .from('drill_user_stats')
      .select('streak_days')
      .eq('user_id', userId)
      .maybeSingle();
    if (e3) throw new Error(e3.message);

    return {
      due: due ?? 0,
      total: total ?? 0,
      streak: Number(st?.streak_days ?? 0),
    };
  }
}
