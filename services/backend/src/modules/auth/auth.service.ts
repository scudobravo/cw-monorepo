import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class AuthService {
  private supabase: SupabaseClient;

  constructor(private config: ConfigService) {
    this.supabase = createClient(
      this.config.get<string>('supabase.url')!,
      this.config.get<string>('supabase.serviceRoleKey')!,
    );
  }

  /** Verify a Supabase JWT and return the user, or null if invalid. */
  async verifyToken(token: string) {
    const { data, error } = await this.supabase.auth.getUser(token);
    if (error || !data.user) return null;
    return data.user;
  }

  /** Get or create a user profile row in public.profiles */
  async getOrCreateProfile(userId: string, email: string) {
    const { data, error } = await this.supabase
      .from('profiles')
      .upsert({ id: userId, email, updated_at: new Date().toISOString() })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }
}
