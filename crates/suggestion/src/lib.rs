//! Suggestion preparation module.
//! Formats AI responses for display in the appropriate output channel.

use chrono::Utc;
use cw_core::{StealthOutputChannel, Suggestion, SuggestionType};
use uuid::Uuid;

pub struct SuggestionBuilder;

impl SuggestionBuilder {
    /// Create a new suggestion from AI response
    pub fn build(
        session_id: Uuid,
        suggestion_type: SuggestionType,
        content: String,
        delivered_via: Option<StealthOutputChannel>,
    ) -> Suggestion {
        Suggestion {
            id: Uuid::new_v4(),
            session_id,
            suggestion_type,
            content,
            timestamp: Utc::now(),
            delivered_via,
        }
    }
}
