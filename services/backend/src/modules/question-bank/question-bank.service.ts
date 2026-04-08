import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface QuestionRow {
  id: string;
  product: string;
  mode: string;
  text: string;
  answer: string;
  suggestion_type: string;
  asked_count: number;
  created_at: string;
}

export interface FindSimilarOptions {
  embedding: number[];
  product: string;
  mode: string;
  threshold?: number;  // default 0.92
}

export interface StoreOptions {
  text: string;
  embedding: number[];
  answer: string;
  suggestionType: string;
  product: string;
  mode: string;
}

@Injectable()
export class QuestionBankService {
  private readonly logger = new Logger(QuestionBankService.name);
  private supabase: SupabaseClient;

  constructor(private config: ConfigService) {
    this.supabase = createClient(
      this.config.get<string>('supabase.url')!,
      this.config.get<string>('supabase.serviceRoleKey')!,
    );
  }

  /**
   * Semantic search: find a cached question+answer with cosine similarity
   * above the threshold. Uses the `match_questions` Postgres function.
   */
  async findSimilar(opts: FindSimilarOptions): Promise<QuestionRow | null> {
    const threshold = opts.threshold ?? 0.92;

    const { data, error } = await this.supabase.rpc('match_questions', {
      query_embedding: opts.embedding,
      match_threshold: threshold,
      match_count: 1,
      p_product: opts.product,
      p_mode: opts.mode,
    });

    if (error) {
      this.logger.warn(`Question bank search error: ${error.message}`);
      return null;
    }

    return (data as QuestionRow[])?.[0] ?? null;
  }

  /** Store a new question + answer + embedding in the DB. */
  async store(opts: StoreOptions): Promise<QuestionRow> {
    const { data, error } = await this.supabase
      .from('questions')
      .insert({
        product: opts.product,
        mode: opts.mode,
        text: opts.text,
        embedding: opts.embedding,
        answer: opts.answer,
        suggestion_type: opts.suggestionType,
        asked_count: 1,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to store question: ${error.message}`);
    this.logger.log(`Stored new question: "${opts.text.slice(0, 60)}…"`);
    return data as QuestionRow;
  }

  /** Increment the asked_count counter when a cache hit occurs. */
  async incrementCount(id: string): Promise<void> {
    await this.supabase.rpc('increment_question_count', { question_id: id });
  }

  /** Return most-asked questions, optionally filtered by product/mode. */
  async getTopQuestions(opts: {
    product?: string;
    mode?: string;
    limit?: number;
  }): Promise<QuestionRow[]> {
    let query = this.supabase
      .from('questions')
      .select('id, product, mode, text, answer, suggestion_type, asked_count, created_at')
      .order('asked_count', { ascending: false })
      .limit(opts.limit ?? 20);

    if (opts.product) query = query.eq('product', opts.product);
    if (opts.mode) query = query.eq('mode', opts.mode);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []) as QuestionRow[];
  }
}
