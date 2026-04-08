import { createClient } from '@supabase/supabase-js';
import type { SessionRow } from './api';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

export async function listSessionsDirect(product: string): Promise<SessionRow[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('product', product)
    .order('started_at', { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return (data ?? []) as SessionRow[];
}

export async function getTopQuestionsDirect(
  product: string,
  limit = 8,
): Promise<{ id: string; text: string; asked_count: number; mode: string }[]> {
  const { data, error } = await supabase
    .from('questions')
    .select('id, text, asked_count, mode')
    .eq('product', product)
    .order('asked_count', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
}
