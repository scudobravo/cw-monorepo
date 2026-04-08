//! Entitlement verification and feature gating.
//! Caches signed entitlement snapshots from the backend.

use chrono::Utc;
use cw_core::{AppError, EntitlementSnapshot};
use std::sync::Arc;
use tokio::sync::RwLock;

pub struct PolicyGuard {
    snapshot: Arc<RwLock<Option<EntitlementSnapshot>>>,
    backend_url: String,
}

impl PolicyGuard {
    pub fn new(backend_url: String) -> Self {
        Self {
            snapshot: Arc::new(RwLock::new(None)),
            backend_url,
        }
    }

    /// Resolve entitlements from the backend
    pub async fn resolve(&self, token: &str) -> Result<EntitlementSnapshot, AppError> {
        let client = reqwest::Client::new();
        let snapshot: EntitlementSnapshot = client
            .get(format!("{}/entitlements/resolve", self.backend_url))
            .bearer_auth(token)
            .send()
            .await
            .map_err(|e| AppError::Network(e.to_string()))?
            .json()
            .await
            .map_err(|e| AppError::Network(e.to_string()))?;

        *self.snapshot.write().await = Some(snapshot.clone());
        Ok(snapshot)
    }

    /// Check if a specific feature is enabled
    pub async fn has_feature(&self, feature: &str) -> bool {
        let snapshot = self.snapshot.read().await;
        snapshot
            .as_ref()
            .map(|s| s.expires_at > Utc::now() && s.features.iter().any(|f| f == feature))
            .unwrap_or(false)
    }

    /// Check if stealth mode is enabled for this user's plan
    pub async fn stealth_enabled(&self) -> bool {
        let snapshot = self.snapshot.read().await;
        snapshot
            .as_ref()
            .map(|s| s.expires_at > Utc::now() && s.stealth_enabled)
            .unwrap_or(false)
    }
}
