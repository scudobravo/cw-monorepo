//! Assembles context frames for AI inference by combining
//! transcript, session state, screen context, and knowledge packs.

use cw_core::{ContextFrame, SessionMode, TranscriptSegment};
use uuid::Uuid;

pub struct ContextAssembler {
    /// Maximum number of transcript segments to include in context window
    max_transcript_window: usize,
}

impl ContextAssembler {
    pub fn new(max_transcript_window: usize) -> Self {
        Self {
            max_transcript_window,
        }
    }

    /// Assemble a context frame from current state
    pub fn assemble(
        &self,
        session_id: Uuid,
        session_mode: SessionMode,
        transcript: &[TranscriptSegment],
        stealth_active: bool,
        screen_context: Option<String>,
        knowledge_context: Option<String>,
    ) -> ContextFrame {
        let window_start = transcript.len().saturating_sub(self.max_transcript_window);
        let transcript_window = transcript[window_start..].to_vec();

        ContextFrame {
            session_id,
            transcript_window,
            session_mode,
            stealth_active,
            screen_context,
            knowledge_context,
        }
    }
}
