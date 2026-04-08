use cw_core::{CallState, StealthConfig, StealthOutputChannel, Suggestion};
use std::sync::Arc;
use tokio::sync::{watch, RwLock};
use tracing::info;

use crate::detector::CallDetector;

/// Central stealth coordinator that manages invisibility state
/// and routes suggestions to the appropriate output channel
pub struct StealthCoordinator {
    config: Arc<RwLock<StealthConfig>>,
    detector: CallDetector,
    active: Arc<RwLock<bool>>,
}

/// Decision on how to deliver a suggestion
#[derive(Debug, Clone)]
pub struct DeliveryDecision {
    pub channel: StealthOutputChannel,
    pub suggestion: Suggestion,
    pub stealth_active: bool,
}

impl StealthCoordinator {
    pub fn new(config: StealthConfig) -> Self {
        Self {
            config: Arc::new(RwLock::new(config)),
            detector: CallDetector::new(),
            active: Arc::new(RwLock::new(false)),
        }
    }

    /// Subscribe to call state changes
    pub fn call_state_receiver(&self) -> watch::Receiver<CallState> {
        self.detector.subscribe()
    }

    /// Check if stealth mode is currently active
    pub async fn is_active(&self) -> bool {
        *self.active.read().await
    }

    /// Manually activate/deactivate stealth mode
    pub async fn set_active(&self, active: bool) {
        *self.active.write().await = active;
        info!(
            "Stealth mode: {}",
            if active { "activated" } else { "deactivated" }
        );
    }

    /// Update stealth configuration
    pub async fn update_config(&self, config: StealthConfig) {
        *self.config.write().await = config;
    }

    /// Get current configuration
    pub async fn get_config(&self) -> StealthConfig {
        self.config.read().await.clone()
    }

    /// Decide how to deliver a suggestion based on current stealth state
    pub async fn decide_delivery(&self, suggestion: Suggestion) -> DeliveryDecision {
        let is_active = *self.active.read().await;
        let config = self.config.read().await;

        let channel = if is_active {
            config.output_channel
        } else {
            // When not in stealth, show in main window (use overlay as default)
            StealthOutputChannel::Overlay
        };

        DeliveryDecision {
            channel,
            suggestion,
            stealth_active: is_active,
        }
    }

    /// Start the stealth coordinator background tasks
    pub async fn start(&self) {
        let config = self.config.read().await.clone();
        self.detector.start_monitoring(Arc::new(config)).await;

        // Auto-activate stealth when a call is detected
        let mut call_rx = self.detector.subscribe();
        let active = self.active.clone();
        let auto_hide = self.config.read().await.auto_hide_during_calls;

        if auto_hide {
            tokio::spawn(async move {
                while call_rx.changed().await.is_ok() {
                    let call_state = *call_rx.borrow();
                    let should_stealth =
                        matches!(call_state, CallState::CallDetected | CallState::InCall);
                    *active.write().await = should_stealth;
                    info!(
                        "Auto-stealth: {} (call state: {:?})",
                        if should_stealth { "on" } else { "off" },
                        call_state
                    );
                }
            });
        }
    }

    /// Get the call detector for manual state changes
    pub fn detector(&self) -> &CallDetector {
        &self.detector
    }
}
