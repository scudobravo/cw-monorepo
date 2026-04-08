//! Inference orchestrator that decides what type of suggestion
//! to generate based on the current context.

use cw_core::{ContextFrame, SuggestionType};

pub struct InferenceOrchestrator;

impl InferenceOrchestrator {
    pub fn new() -> Self {
        Self
    }

    /// Decide what type of suggestion to generate
    pub fn decide_suggestion_type(&self, context: &ContextFrame) -> SuggestionType {
        // TODO: Implement intelligent decision logic
        // For now, return a default based on session mode
        match context.session_mode {
            cw_core::SessionMode::DevOracle(_) => {
                if context.stealth_active {
                    SuggestionType::Hint // Shorter in stealth
                } else {
                    SuggestionType::Explanation
                }
            }
            cw_core::SessionMode::RingWise(_) => {
                SuggestionType::NextResponse
            }
        }
    }
}
