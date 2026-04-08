import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

// Session commands
export interface SessionInfo {
  id: string;
  mode: SessionMode;
  state: SessionState;
  started_at: string;
}

export interface SessionSummary {
  session_id: string;
  duration_secs: number;
  total_suggestions: number;
  transcript_segments: number;
  recap: string | null;
  scorecard: Record<string, unknown> | null;
}

export type SessionMode =
  | { product: "DevOracle"; mode: InterviewMode }
  | { product: "RingWise"; mode: CallMode };

export type InterviewMode =
  | "mock_interview"
  | "behavioral_tech"
  | "coding_interview"
  | "system_design";

export type CallMode =
  | "sales_call"
  | "discovery"
  | "demo"
  | "negotiation"
  | "follow_up";

export type SessionState =
  | "idle"
  | "starting"
  | "active"
  | "paused"
  | "ending"
  | "ended";

export type StealthOutputChannel =
  | "second_screen"
  | "overlay"
  | "haptic"
  | "system_tray";

export interface StealthConfig {
  auto_hide_during_calls: boolean;
  output_channel: StealthOutputChannel;
  hotkey: string;
  exclude_from_screen_capture: boolean;
  show_only_on_second_screen: boolean;
}

export interface AudioDevice {
  name: string;
  is_default: boolean;
}

export interface Suggestion {
  id: string;
  session_id: string;
  suggestion_type: string;
  content: string;
  timestamp: string;
  source?: string | null;
  priority?: string | null;
  buying_signal_type?: string | null;
  delivered_via?: StealthOutputChannel | null;
}

/** DevOracle vocal coaching (NestJS transcription gateway). */
export interface VocalMetrics {
  filler_count_session: number;
  filler_count_segment: number;
  words_per_minute: number;
  wpm_status: "slow" | "ideal" | "fast";
  silence_seconds: number;
}

export interface SilenceDetectedPayload {
  duration_secs: number;
  suggested_action: string;
}

export interface TranscriptSegment {
  id: string;
  session_id: string;
  speaker: "user" | "other";
  text: string;
  timestamp: string;
  confidence: number;
  word_count: number;
  session_word_counts: { user: number; other: number };
  talk_ratio_user: number;
  vocal_metrics?: VocalMetrics | null;
}

export interface CompetitorCard {
  id: string;
  name: string;
  win_points: string[];
  lose_points: string[];
  positioning: string;
  trap_questions: string[];
}

// Session
export const startSession = (mode: SessionMode) =>
  invoke<SessionInfo>("start_session", { mode });

export const stopSession = () =>
  invoke<SessionSummary>("stop_session");

export const startAudioPipeline = (
  sessionId: string,
  token: string,
  backendWsUrl: string,
  companySlug?: string | null,
) =>
  invoke<void>("start_audio_pipeline", {
    session_id: sessionId,
    token,
    backend_ws_url: backendWsUrl,
    company_slug: companySlug ?? null,
  });

export const stopAudioPipeline = () => invoke<void>("stop_audio_pipeline");

export const getSessionState = () =>
  invoke<SessionState | null>("get_session_state");

// Audio
export const listAudioDevices = () =>
  invoke<AudioDevice[]>("list_audio_devices");

export const testAudio = () =>
  invoke<boolean>("test_audio");

// Stealth
export const getStealthConfig = () =>
  invoke<StealthConfig>("get_stealth_config");

export const updateStealthConfig = (config: StealthConfig) =>
  invoke<void>("update_stealth_config", { config });

export const toggleStealth = () =>
  invoke<boolean>("toggle_stealth");

export const getStealthState = () =>
  invoke<boolean>("get_stealth_state");

// Settings
export const getAppVersion = () =>
  invoke<string>("get_app_version");

// Overlay (DevOracle floating window)
export const openOverlay = () => invoke<void>("open_overlay");
export const closeOverlay = () => invoke<void>("close_overlay");
export const toggleOverlay = () => invoke<boolean>("toggle_overlay");

/** macOS: active browser tab URL if LeetCode / NeetCode / HackerRank problem page */
export const detectLeetcodeProblem = () =>
  invoke<string | null>("detect_leetcode_problem");

// Events
export const onSuggestion = (callback: (suggestion: Suggestion) => void): Promise<UnlistenFn> =>
  listen<Suggestion>("suggestion", (event) => callback(event.payload));

export const onTranscriptSegment = (
  callback: (segment: TranscriptSegment) => void,
): Promise<UnlistenFn> =>
  listen<TranscriptSegment>("transcript_segment", (event) => callback(event.payload));

export const onCompetitorDetected = (
  callback: (card: CompetitorCard) => void,
): Promise<UnlistenFn> =>
  listen<CompetitorCard>("competitor_detected", (event) => callback(event.payload));

export const onSilenceDetected = (
  callback: (payload: SilenceDetectedPayload) => void,
): Promise<UnlistenFn> =>
  listen<SilenceDetectedPayload>("silence_detected", (event) => callback(event.payload));

export const onStealthStateChanged = (callback: (active: boolean) => void): Promise<UnlistenFn> =>
  listen<boolean>("stealth_state_changed", (event) => callback(event.payload));
