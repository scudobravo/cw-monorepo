//! Telemetry and diagnostics module.
//! Collects metrics, events, and sends them to the backend.

use chrono::Utc;
use cw_core::StealthOutputChannel;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelemetryEvent {
    pub id: Uuid,
    pub event_type: String,
    pub properties: serde_json::Value,
    pub timestamp: chrono::DateTime<Utc>,
}

pub struct TelemetryCollector {
    events: tokio::sync::Mutex<Vec<TelemetryEvent>>,
    backend_url: String,
}

impl TelemetryCollector {
    pub fn new(backend_url: String) -> Self {
        Self {
            events: tokio::sync::Mutex::new(Vec::new()),
            backend_url,
        }
    }

    /// Track a generic event
    pub async fn track(&self, event_type: &str, properties: serde_json::Value) {
        let event = TelemetryEvent {
            id: Uuid::new_v4(),
            event_type: event_type.to_string(),
            properties,
            timestamp: Utc::now(),
        };
        self.events.lock().await.push(event);
    }

    /// Track stealth mode activation
    pub async fn track_stealth_activated(&self) {
        self.track("stealth_mode_activated", serde_json::json!({})).await;
    }

    /// Track stealth mode deactivation
    pub async fn track_stealth_deactivated(&self) {
        self.track("stealth_mode_deactivated", serde_json::json!({})).await;
    }

    /// Track a privately delivered suggestion
    pub async fn track_private_suggestion(&self, channel: StealthOutputChannel) {
        self.track(
            "suggestion_delivered_privately",
            serde_json::json!({ "channel": channel }),
        ).await;
    }

    /// Track hotkey peek triggered
    pub async fn track_hotkey_peek(&self) {
        self.track("hotkey_peek_triggered", serde_json::json!({})).await;
    }

    /// Flush events to the backend
    pub async fn flush(&self) -> Result<(), cw_core::AppError> {
        let events: Vec<TelemetryEvent> = {
            let mut lock = self.events.lock().await;
            std::mem::take(&mut *lock)
        };

        if events.is_empty() {
            return Ok(());
        }

        reqwest::Client::new()
            .post(format!("{}/telemetry/events", self.backend_url))
            .json(&events)
            .send()
            .await
            .map_err(|e| cw_core::AppError::Network(e.to_string()))?;

        Ok(())
    }
}
