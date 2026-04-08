import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { UpsertCompetitorDto } from './dto/upsert-competitor.dto';

export interface CompetitorRow {
  id: string;
  name: string;
  aliases: string[] | null;
  win_points: string[] | null;
  lose_points: string[] | null;
  positioning: string;
  trap_questions: string[] | null;
  product: string;
  created_at?: string | null;
}

@Injectable()
export class CompetitorsService {
  private supabase: SupabaseClient;

  constructor(private config: ConfigService) {
    this.supabase = createClient(
      this.config.get<string>('supabase.url')!,
      this.config.get<string>('supabase.serviceRoleKey')!,
    );
  }

  /**
   * First match wins. Longer terms are checked first to avoid partial matches (e.g. Hub vs HubSpot).
   */
  async detectInText(
    text: string,
    product: string,
  ): Promise<CompetitorRow | null> {
    const { data, error } = await this.supabase
      .from('competitors')
      .select('*')
      .eq('product', product);
    if (error || !data?.length) {
      return null;
    }
    const rows = data as CompetitorRow[];
    const lower = text.toLowerCase();

    const termHits: { row: CompetitorRow; term: string }[] = [];
    for (const row of rows) {
      const terms = [row.name, ...(row.aliases ?? [])].filter(
        (t): t is string => Boolean(t && t.trim()),
      );
      for (const term of terms) {
        termHits.push({ row, term });
      }
    }
    termHits.sort((a, b) => b.term.length - a.term.length);

    for (const { row, term } of termHits) {
      if (lower.includes(term.toLowerCase())) {
        return row;
      }
    }
    return null;
  }

  async findAll(product?: string): Promise<CompetitorRow[]> {
    let q = this.supabase.from('competitors').select('*').order('name');
    if (product) {
      q = q.eq('product', product);
    }
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data ?? []) as CompetitorRow[];
  }

  async upsert(dto: UpsertCompetitorDto): Promise<CompetitorRow> {
    const payload = {
      name: dto.name,
      aliases: dto.aliases ?? [],
      win_points: dto.win_points ?? [],
      lose_points: dto.lose_points ?? [],
      positioning: dto.positioning,
      trap_questions: dto.trap_questions ?? [],
      product: dto.product,
    };

    if (dto.id) {
      const { data, error } = await this.supabase
        .from('competitors')
        .update(payload)
        .eq('id', dto.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as CompetitorRow;
    }

    const { data, error } = await this.supabase
      .from('competitors')
      .upsert(payload, { onConflict: 'name' })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as CompetitorRow;
  }
}
