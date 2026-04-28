import { create } from "zustand";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  SessionInfo,
  SessionMode,
  SessionState,
  Suggestion,
  TranscriptSegment,
  VocalMetrics,
} from "../lib/tauri";
import * as tauri from "../lib/tauri";
import { patchSessionEnd, transcriptionWsUrl } from "../lib/api";
import { useAuthStore } from "./authStore";

const TARGET_COMPANY_STORAGE_KEY = "devoracle_target_company";

function readStoredTargetCompany(): string | null {
  try {
    const v = localStorage.getItem(TARGET_COMPANY_STORAGE_KEY);
    return v?.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}

export interface TalkRatioState {
  userWords: number;
  otherWords: number;
  ratio: number;
}

const initialTalkRatio: TalkRatioState = {
  userWords: 0,
  otherWords: 0,
  ratio: 0,
};

interface SessionStore {
  session: SessionInfo | null;
  state: SessionState | null;
  suggestions: Suggestion[];
  talkRatio: TalkRatioState;
  /** Latest vocal metrics from transcript segments (DevOracle). */
  vocalMetrics: VocalMetrics | null;
  /** Target company slug for DevOracle prep (persisted in localStorage). */
  targetCompany: string | null;
  remoteSessionId: string | null;
  backendSessionUnlisten: UnlistenFn | null;
  isLoading: boolean;
  error: string | null;

  startSession: (mode: SessionMode) => Promise<void>;
  stopSession: () => Promise<void>;
  addSuggestion: (suggestion: Suggestion) => void;
  applyTranscriptSegment: (segment: TranscriptSegment) => void;
  setTargetCompany: (slug: string | null) => void;
  clearError: () => void;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  session: null,
  state: null,
  suggestions: [],
  talkRatio: initialTalkRatio,
  vocalMetrics: null,
  targetCompany: readStoredTargetCompany(),
  remoteSessionId: null,
  backendSessionUnlisten: null,
  isLoading: false,
  error: null,

  startSession: async (mode) => {
    get().backendSessionUnlisten?.();
    set({
      isLoading: true,
      error: null,
      talkRatio: initialTalkRatio,
      vocalMetrics: null,
      remoteSessionId: null,
      backendSessionUnlisten: null,
    });
    try {
      const session = await tauri.startSession(mode);
      set({ session, state: session.state, isLoading: false });
      const token = useAuthStore.getState().token();
      if (token) {
        const companySlug = get().targetCompany;
        // Register listeners BEFORE starting the pipeline to avoid losing
        // events that fire before the await resolves.
        const [unlistenReady, unlistenError] = await Promise.all([
          listen<{ session_id: string }>("backend_session_ready", (e) => {
            set({ remoteSessionId: e.payload.session_id });
          }),
          listen<{ message: string }>("backend_session_error", (e) => {
            set({ error: e.payload.message, isLoading: false });
          }),
        ]);
        const unlisten = () => {
          unlistenReady();
          unlistenError();
        };
        set({ backendSessionUnlisten: unlisten });
        await tauri.startAudioPipeline(
          session.id,
          token,
          transcriptionWsUrl(),
          companySlug,
        );
      }
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  stopSession: async () => {
    set({ isLoading: true });
    try {
      const session = get().session;
      const talkRatio = get().talkRatio;
      const suggestionsCount = get().suggestions.length;
      const remoteSessionId = get().remoteSessionId;
      const token = useAuthStore.getState().token();

      get().backendSessionUnlisten?.();
      set({ backendSessionUnlisten: null });

      await tauri.stopAudioPipeline();
      await tauri.stopSession();

      if (session && token) {
        const sessionId = remoteSessionId ?? String(session.id);
        const duration_secs = Math.max(
          0,
          Math.round((Date.now() - new Date(session.started_at).getTime()) / 1000),
        );
        await patchSessionEnd(token, sessionId, {
          duration_secs,
          total_suggestions: suggestionsCount,
          talk_ratio_user: Math.round(talkRatio.ratio * 10) / 10,
        });
      }

      set({
        session: null,
        state: null,
        suggestions: [],
        talkRatio: initialTalkRatio,
        vocalMetrics: null,
        remoteSessionId: null,
        isLoading: false,
      });
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  addSuggestion: (suggestion) => {
    set((s) => ({ suggestions: [...s.suggestions, suggestion] }));
  },

  applyTranscriptSegment: (segment) => {
    set({
      talkRatio: {
        userWords: segment.session_word_counts.user,
        otherWords: segment.session_word_counts.other,
        ratio: segment.talk_ratio_user,
      },
      ...(segment.vocal_metrics != null
        ? { vocalMetrics: segment.vocal_metrics }
        : {}),
    });
  },

  setTargetCompany: (slug) => {
    try {
      if (slug) localStorage.setItem(TARGET_COMPANY_STORAGE_KEY, slug);
      else localStorage.removeItem(TARGET_COMPANY_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    set({ targetCompany: slug });
  },

  clearError: () => set({ error: null }),
}));
