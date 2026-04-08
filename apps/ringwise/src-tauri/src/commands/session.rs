use crate::AppState;
use cw_audio_capture::capture::{start_capture, AudioChunk};
use cw_core::{
    AppError, SessionInfo, SessionMode, SessionState, SessionSummary, Speaker, VocalMetrics,
};
use cw_transcription::pipeline::TranscriptionPipeline;
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::{broadcast::error::RecvError, mpsc};
use uuid::Uuid;

#[tauri::command]
pub async fn start_session(
    state: State<'_, AppState>,
    mode: SessionMode,
) -> Result<SessionInfo, AppError> {
    state.session_engine.start(mode).await
}

#[tauri::command]
pub async fn stop_session(state: State<'_, AppState>) -> Result<SessionSummary, AppError> {
    state.session_engine.stop().await
}

#[tauri::command]
pub async fn get_session_state(state: State<'_, AppState>) -> Result<Option<SessionState>, AppError> {
    Ok(state.session_engine.current_state().await)
}

#[derive(Clone, Serialize)]
struct SessionWordCountsPayload {
    user: u32,
    other: u32,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "snake_case")]
struct VocalMetricsPayload {
    filler_count_session: u32,
    filler_count_segment: u32,
    words_per_minute: f32,
    wpm_status: String,
    silence_seconds: f32,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "snake_case")]
struct TranscriptSegmentPayload {
    id: String,
    session_id: String,
    speaker: &'static str,
    text: String,
    timestamp: String,
    confidence: f32,
    word_count: u32,
    session_word_counts: SessionWordCountsPayload,
    talk_ratio_user: f32,
    #[serde(skip_serializing_if = "Option::is_none")]
    vocal_metrics: Option<VocalMetricsPayload>,
}

fn vocal_metrics_payload(vm: &VocalMetrics) -> VocalMetricsPayload {
    VocalMetricsPayload {
        filler_count_session: vm.filler_count_session,
        filler_count_segment: vm.filler_count_segment,
        words_per_minute: vm.words_per_minute,
        wpm_status: vm.wpm_status.clone(),
        silence_seconds: vm.silence_seconds,
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "snake_case")]
struct SuggestionPayload {
    id: String,
    session_id: String,
    suggestion_type: String,
    content: String,
    timestamp: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    source: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    priority: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    buying_signal_type: Option<String>,
}

fn speaker_label(s: Speaker) -> &'static str {
    match s {
        Speaker::User => "user",
        Speaker::Interviewer | Speaker::Other => "other",
    }
}

fn chunk_to_f32_mono(chunk: AudioChunk) -> (Vec<f32>, u32) {
    let ch = chunk.channels.max(1) as usize;
    let samples = if ch <= 1 {
        chunk.samples
    } else {
        let frames = chunk.samples.len() / ch;
        let mut out = Vec::with_capacity(frames);
        for i in 0..frames {
            let mut sum = 0f32;
            for c in 0..ch {
                sum += chunk.samples[i * ch + c];
            }
            out.push(sum / ch as f32);
        }
        out
    };
    (samples, chunk.sample_rate)
}

pub(crate) struct RunningPipeline {
    pipeline: TranscriptionPipeline,
    /// Audio capture runs on a std thread (cpal stream is not Send on macOS).
    bridge: std::thread::JoinHandle<()>,
    transcript_events: tokio::task::JoinHandle<()>,
    suggestion_events: tokio::task::JoinHandle<()>,
    competitor_events: tokio::task::JoinHandle<()>,
    silence_events: tokio::task::JoinHandle<()>,
}

#[tauri::command]
pub async fn start_audio_pipeline(
    app: AppHandle,
    state: State<'_, AppState>,
    session_id: String,
    token: String,
    backend_ws_url: String,
    company_slug: Option<String>,
) -> Result<(), String> {
    let sid = Uuid::parse_str(&session_id).map_err(|e| e.to_string())?;

    let session = state
        .session_engine
        .active_session()
        .await
        .ok_or_else(|| "No active session".to_string())?;
    if session.id != sid {
        return Err("Session id does not match active session".to_string());
    }

    let mut guard = state.audio_pipeline.lock().await;
    if guard.is_some() {
        return Err("Audio pipeline already running".to_string());
    }

    let pipeline = TranscriptionPipeline::new(
        backend_ws_url,
        token,
        sid,
        session.mode,
        company_slug,
    );

    let (audio_tx, audio_rx) = mpsc::channel::<(Vec<f32>, u32)>(64);
    let audio_tx_bridge = audio_tx.clone();
    let rt_handle = tokio::runtime::Handle::current();
    // cpal stream must be created and kept on one OS thread (not Send on macOS).
    let bridge = std::thread::spawn(move || {
        let (mut cap_rx, capture) = match start_capture(None) {
            Ok(v) => v,
            Err(e) => {
                tracing::error!("start_capture failed: {}", e);
                return;
            }
        };
        rt_handle.block_on(async move {
            let _keep_capture_alive = capture;
            while let Some(chunk) = cap_rx.recv().await {
                let frame = chunk_to_f32_mono(chunk);
                if audio_tx_bridge.send(frame).await.is_err() {
                    break;
                }
            }
        });
    });

    let (backend_tx, mut backend_rx) = mpsc::channel::<String>(4);
    let (mut transcript_rx, mut suggestion_rx, mut competitor_rx, mut silence_rx) = pipeline
        .start(audio_rx, Some(backend_tx))
        .await
        .map_err(|e: AppError| e.to_string())?;

    let app_ready = app.clone();
    tokio::spawn(async move {
        if let Some(id) = backend_rx.recv().await {
            let _ = app_ready.emit(
                "backend_session_ready",
                serde_json::json!({ "session_id": id }),
            );
        }
    });

    let app_t = app.clone();
    let transcript_events = tokio::spawn(async move {
        loop {
            match transcript_rx.recv().await {
                Ok(seg) => {
                    let payload = TranscriptSegmentPayload {
                        id: seg.id.to_string(),
                        session_id: seg.session_id.to_string(),
                        speaker: speaker_label(seg.speaker),
                        text: seg.text,
                        timestamp: seg.timestamp.to_rfc3339(),
                        confidence: seg.confidence,
                        word_count: seg.word_count,
                        session_word_counts: SessionWordCountsPayload {
                            user: seg.session_word_counts.user,
                            other: seg.session_word_counts.other,
                        },
                        talk_ratio_user: seg.talk_ratio_user,
                        vocal_metrics: seg
                            .vocal_metrics
                            .as_ref()
                            .map(vocal_metrics_payload),
                    };
                    let _ = app_t.emit("transcript_segment", payload);
                }
                Err(RecvError::Lagged(_)) => continue,
                Err(RecvError::Closed) => break,
            }
        }
    });

    let app_s = app.clone();
    let session_id_for_suggestions = sid.to_string();
    let suggestion_events = tokio::spawn(async move {
        loop {
            match suggestion_rx.recv().await {
                Ok(s) => {
                    let payload = SuggestionPayload {
                        id: s.id,
                        session_id: session_id_for_suggestions.clone(),
                        suggestion_type: s.suggestion_type,
                        content: s.content,
                        timestamp: s.timestamp,
                        source: s.source,
                        priority: s.priority,
                        buying_signal_type: s.buying_signal_type,
                    };
                    let _ = app_s.emit("suggestion", payload);
                }
                Err(RecvError::Lagged(_)) => continue,
                Err(RecvError::Closed) => break,
            }
        }
    });

    let app_c = app.clone();
    let competitor_events = tokio::spawn(async move {
        loop {
            match competitor_rx.recv().await {
                Ok(card) => {
                    let _ = app_c.emit("competitor_detected", card);
                }
                Err(RecvError::Lagged(_)) => continue,
                Err(RecvError::Closed) => break,
            }
        }
    });

    let app_sl = app.clone();
    let silence_events = tokio::spawn(async move {
        loop {
            match silence_rx.recv().await {
                Ok(ev) => {
                    let _ = app_sl.emit("silence_detected", ev);
                }
                Err(RecvError::Lagged(_)) => continue,
                Err(RecvError::Closed) => break,
            }
        }
    });

    *guard = Some(RunningPipeline {
        pipeline,
        bridge,
        transcript_events,
        suggestion_events,
        competitor_events,
        silence_events,
    });
    Ok(())
}

#[tauri::command]
pub async fn stop_audio_pipeline(state: State<'_, AppState>) -> Result<(), String> {
    let mut guard = state.audio_pipeline.lock().await;
    if let Some(run) = guard.take() {
        run.transcript_events.abort();
        run.suggestion_events.abort();
        run.competitor_events.abort();
        run.silence_events.abort();
        run.pipeline
            .stop()
            .await
            .map_err(|e: AppError| e.to_string())?;
        let _ = run.bridge.join();
    }
    Ok(())
}
