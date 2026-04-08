//! Session state machine that orchestrates a live session.

use chrono::Utc;
use cw_core::{AppError, Session, SessionInfo, SessionMode, SessionState, SessionSummary};
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

pub struct SessionEngine {
    current: Arc<RwLock<Option<Session>>>,
}

impl SessionEngine {
    pub fn new() -> Self {
        Self {
            current: Arc::new(RwLock::new(None)),
        }
    }

    /// Start a new session
    pub async fn start(&self, mode: SessionMode) -> Result<SessionInfo, AppError> {
        let mut current = self.current.write().await;
        if current.is_some() {
            return Err(AppError::Session("A session is already active".into()));
        }

        let session = Session {
            id: Uuid::new_v4(),
            mode,
            state: SessionState::Active,
            started_at: Utc::now(),
            ended_at: None,
            stealth_active: false,
        };

        let info = SessionInfo {
            id: session.id,
            mode: session.mode,
            state: session.state,
            started_at: session.started_at,
        };

        *current = Some(session);
        Ok(info)
    }

    /// Stop the current session
    pub async fn stop(&self) -> Result<SessionSummary, AppError> {
        let mut current = self.current.write().await;
        let session = current.take().ok_or(AppError::Session("No active session".into()))?;

        let ended_at = Utc::now();
        let duration = (ended_at - session.started_at).num_seconds() as u64;

        Ok(SessionSummary {
            session_id: session.id,
            duration_secs: duration,
            total_suggestions: 0, // TODO: track during session
            transcript_segments: 0,
            recap: None,
            scorecard: None,
        })
    }

    /// Get current session state
    pub async fn current_state(&self) -> Option<SessionState> {
        self.current.read().await.as_ref().map(|s| s.state)
    }

    /// Snapshot of the active session, if any
    pub async fn active_session(&self) -> Option<Session> {
        self.current.read().await.clone()
    }

    /// Update stealth status on the current session
    pub async fn set_stealth(&self, active: bool) {
        if let Some(session) = self.current.write().await.as_mut() {
            session.stealth_active = active;
        }
    }
}
