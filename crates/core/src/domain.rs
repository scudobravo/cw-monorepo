use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::types::{SessionMode, StealthOutputChannel, SuggestionType};

/// Represents an active or completed session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub id: Uuid,
    pub mode: SessionMode,
    pub state: SessionState,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub stealth_active: bool,
}

/// Session lifecycle states
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SessionState {
    Idle,
    Starting,
    Active,
    Paused,
    Ending,
    Ended,
}

/// Cumulative word counts for talk-ratio tracking (mirrors NestJS payload).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionWordCounts {
    pub user: u32,
    pub other: u32,
}

/// Vocal coaching metrics (DevOracle / NestJS transcription gateway).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VocalMetrics {
    pub filler_count_session: u32,
    pub filler_count_segment: u32,
    pub words_per_minute: f32,
    pub wpm_status: String,
    pub silence_seconds: f32,
}

/// Emitted when speech is idle longer than the server threshold (e.g. 12s).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SilenceDetectedPayload {
    pub duration_secs: f32,
    pub suggested_action: String,
}

/// A segment of transcribed speech
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptSegment {
    pub id: Uuid,
    pub session_id: Uuid,
    pub speaker: Speaker,
    pub text: String,
    pub timestamp: DateTime<Utc>,
    pub confidence: f32,
    pub word_count: u32,
    pub session_word_counts: SessionWordCounts,
    pub talk_ratio_user: f32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub vocal_metrics: Option<VocalMetrics>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Speaker {
    User,
    Interviewer,
    Other,
}

/// An AI-generated suggestion
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Suggestion {
    pub id: Uuid,
    pub session_id: Uuid,
    pub suggestion_type: SuggestionType,
    pub content: String,
    pub timestamp: DateTime<Utc>,
    pub delivered_via: Option<StealthOutputChannel>,
}

/// Context frame assembled for AI inference
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextFrame {
    pub session_id: Uuid,
    pub transcript_window: Vec<TranscriptSegment>,
    pub session_mode: SessionMode,
    pub stealth_active: bool,
    pub screen_context: Option<String>,
    pub knowledge_context: Option<String>,
}

/// User's stealth preferences
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StealthConfig {
    pub auto_hide_during_calls: bool,
    pub output_channel: StealthOutputChannel,
    pub hotkey: String,
    pub exclude_from_screen_capture: bool,
    pub show_only_on_second_screen: bool,
}

impl Default for StealthConfig {
    fn default() -> Self {
        Self {
            auto_hide_during_calls: true,
            output_channel: StealthOutputChannel::Overlay,
            hotkey: "CommandOrControl+H".to_string(),
            exclude_from_screen_capture: true,
            show_only_on_second_screen: false,
        }
    }
}

/// Local call detection state
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CallState {
    NoCall,
    CallDetected,
    InCall,
    CallEnding,
}

/// Entitlement snapshot received from backend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntitlementSnapshot {
    pub user_id: String,
    pub product: crate::types::Product,
    pub plan: String,
    pub features: Vec<String>,
    pub stealth_enabled: bool,
    pub expires_at: DateTime<Utc>,
    pub signature: String,
}

/// Session summary generated after a session ends
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionSummary {
    pub session_id: Uuid,
    pub duration_secs: u64,
    pub total_suggestions: u32,
    pub transcript_segments: u32,
    pub recap: Option<String>,
    pub scorecard: Option<serde_json::Value>,
}

/// Session info returned when starting a session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionInfo {
    pub id: Uuid,
    pub mode: SessionMode,
    pub state: SessionState,
    pub started_at: DateTime<Utc>,
}
