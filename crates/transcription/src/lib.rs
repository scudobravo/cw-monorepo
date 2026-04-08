//! Streaming transcription pipeline.
//! Sends audio chunks to the backend via WebSocket and receives transcript segments.

pub mod pipeline;

pub use cw_core::SilenceDetectedPayload;
pub use pipeline::{CompetitorCardPayload, SuggestionFromServer, TranscriptionPipeline};
