import { create } from 'zustand';
import { createClient, type User, type Session } from '@supabase/supabase-js';

const PRODUCT = 'RingWise' as const;

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
  signOut: () => Promise<void>;
  clearError: () => void;
}

/** Verifies the user has a profile for this product. */
async function checkProfile(user: User): Promise<boolean> {
  const { data } = await supabase
    .from('profiles')
    .select('product, products')
    .eq('id', user.id)
    .maybeSingle();

  if (!data) return false;
  return data.product === PRODUCT || (data.products ?? []).includes(PRODUCT);
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
      const ok = await checkProfile(data.session.user);
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

    const ok = await checkProfile(data.user);
    if (!ok) {
      await supabase.auth.signOut();
      set({
        error: 'No RingWise subscription found for this email. Visit ringwise.com to get started.',
        isLoading: false,
      });
      return;
    }

    set({ session: data.session, user: data.user, isLoading: false });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null });
  },

  clearError: () => set({ error: null }),
}));
