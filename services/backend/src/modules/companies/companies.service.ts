import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface CompanyRow {
  id: string;
  name: string;
  slug: string;
  interview_style: string;
  common_topics: string[];
  red_flags: string[];
  system_prompt_addon: string | null;
  logo_emoji: string;
  created_at: string;
}

@Injectable()
export class CompaniesService {
  private supabase: SupabaseClient;

  constructor(private config: ConfigService) {
    this.supabase = createClient(
      this.config.get<string>('supabase.url')!,
      this.config.get<string>('supabase.serviceRoleKey')!,
    );
  }

  async findAll(): Promise<CompanyRow[]> {
    const { data, error } = await this.supabase
      .from('companies')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as CompanyRow[];
  }

  async findBySlug(slug: string): Promise<CompanyRow | null> {
    const s = slug.trim().toLowerCase();
    if (!s) return null;
    const { data, error } = await this.supabase
      .from('companies')
      .select('*')
      .eq('slug', s)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as CompanyRow) ?? null;
  }

  async getBySlugOrThrow(slug: string): Promise<CompanyRow> {
    const row = await this.findBySlug(slug);
    if (!row) throw new NotFoundException('Company not found');
    return row;
  }
}
