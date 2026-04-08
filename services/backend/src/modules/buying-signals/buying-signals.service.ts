import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class BuyingSignalsService {
  private supabase: SupabaseClient;

  constructor(private config: ConfigService) {
    this.supabase = createClient(
      this.config.get<string>('supabase.url')!,
      this.config.get<string>('supabase.serviceRoleKey')!,
    );
  }

  async insert(row: {
    session_id: string;
    signal_type: string;
    trigger_text: string;
  }): Promise<void> {
    const { error } = await this.supabase.from('buying_signals').insert({
      session_id: row.session_id,
      signal_type: row.signal_type,
      trigger_text: row.trigger_text,
    });
    if (error) {
      throw new Error(error.message);
    }
  }

  async countBySession(sessionId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('buying_signals')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId);
    if (error) throw new Error(error.message);
    return count ?? 0;
  }
}
