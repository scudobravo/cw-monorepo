use cw_core::{CallState, StealthConfig};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::watch;
use tracing::info;

/// Method used to detect active calls
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CallDetectionMethod {
    /// Monitor active audio devices via OS API
    AudioDeviceMonitor,
    /// Detect meeting app windows (Zoom, Teams, Meet)
    MeetingWindowDetector,
    /// Heuristic: mic active + meeting window in foreground
    Heuristic,
}

/// Detects whether the user is currently in a call
pub struct CallDetector {
    state_tx: watch::Sender<CallState>,
    state_rx: watch::Receiver<CallState>,
}

impl Default for CallDetector {
    fn default() -> Self {
        Self::new()
    }
}

impl CallDetector {
    pub fn new() -> Self {
        let (state_tx, state_rx) = watch::channel(CallState::NoCall);
        Self { state_tx, state_rx }
    }

    /// Get a receiver to watch call state changes
    pub fn subscribe(&self) -> watch::Receiver<CallState> {
        self.state_rx.clone()
    }

    /// Start monitoring for calls (runs in background)
    pub async fn start_monitoring(&self, _config: Arc<StealthConfig>) {
        info!("Call detector started");
        // TODO: Implement platform-specific call detection
        // - macOS: Monitor CoreAudio for active audio sessions
        // - Windows: Monitor WASAPI for active audio sessions
        // - Both: Monitor for known meeting app windows
    }

    /// Manually set call state (for testing or manual override)
    pub fn set_call_state(&self, state: CallState) {
        let _ = self.state_tx.send(state);
        info!("Call state changed to: {:?}", state);
    }
}
