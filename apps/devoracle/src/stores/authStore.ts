import { create } from 'zustand';
import { createClient, type User, type Session } from '@supabase/supabase-js';

const PRODUCT = 'DevOracle' as const;

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

interface AuthStore {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  error: string | null;

  token: () => string | null;

  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

async function ensureProfile(user: User): Promise<boolean> {
  const { data: existing } = await supabase
    .from('profiles')
    .select('product')
    .eq('id', user.id)
    .maybeSingle();

  if (existing) {
    // Profile exists — check it belongs to this app
    return existing.product === PRODUCT;
  }

  // No profile yet — create one for this app
  const { error } = await supabase.from('profiles').insert({
    id: user.id,
    email: user.email ?? '',
    product: PRODUCT,
  });

  return !error;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  session: null,
  isLoading: true,
  error: null,

  token: () => get().session?.access_token ?? null,

  initialize: async () => {
    set({ isLoading: true });
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      const ok = await ensureProfile(data.session.user);
      if (!ok) {
        await supabase.auth.signOut();
        set({ session: null, user: null, isLoading: false });
        return;
      }
    }
    set({
      session: data.session,
      user: data.session?.user ?? null,
      isLoading: false,
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null });
    });
  },

  signIn: async (email, password) => {
    set({ isLoading: true, error: null });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      set({ error: error.message, isLoading: false });
      return;
    }

    const ok = await ensureProfile(data.user);
    if (!ok) {
      await supabase.auth.signOut();
      set({
        error: 'No DevOracle account found for this email. Please sign up first.',
        isLoading: false,
      });
      return;
    }

    set({ session: data.session, user: data.user, isLoading: false });
  },

  signUp: async (email, password) => {
    set({ isLoading: true, error: null });
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      set({ error: error.message, isLoading: false });
      return;
    }

    if (data.user) {
      await ensureProfile(data.user);
    }

    set({ session: data.session, user: data.user, isLoading: false });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null });
  },

  clearError: () => set({ error: null }),
}));
