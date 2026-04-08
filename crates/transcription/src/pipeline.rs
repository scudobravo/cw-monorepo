use cw_core::{
    AppError, CallMode, InterviewMode, SessionMode, SessionWordCounts, SilenceDetectedPayload,
    Speaker, TranscriptSegment, VocalMetrics,
};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{broadcast, mpsc, RwLock};
use tokio::time::sleep;
use tokio_tungstenite::{connect_async, tungstenite::Message, MaybeTlsStream, WebSocketStream};
use tracing::{debug, error, info, warn};
use uuid::Uuid;

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};

// ── Wire protocol (matches NestJS TranscriptionGateway) ───────

#[derive(Serialize)]
struct WsEvent<T: Serialize> {
    event: &'static str,
    data: T,
}

#[derive(Serialize)]
struct StartSessionPayload {
    token: String,
    product: String,
    mode: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    company_slug: Option<String>,
}

#[derive(Serialize)]
struct AudioChunkPayload {
    audio: String,
}

#[derive(Deserialize, Debug)]
struct ServerMessage {
    event: String,
    data: serde_json::Value,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CompetitorCardPayload {
    pub id: String,
    pub name: String,
    pub win_points: Vec<String>,
    pub lose_points: Vec<String>,
    pub positioning: String,
    pub trap_questions: Vec<String>,
}

#[derive(Deserialize, Debug)]
struct TranscriptData {
    text: String,
    timestamp: String,
    #[serde(default)]
    speaker: Option<String>,
    #[serde(default)]
    word_count: Option<u32>,
    #[serde(default)]
    session_word_counts: Option<SessionWordCountsData>,
    #[serde(default)]
    talk_ratio_user: Option<f32>,
    #[serde(default)]
    vocal_metrics: Option<VocalMetrics>,
    #[serde(default)]
    competitor_detected: Option<CompetitorCardPayload>,
}

#[derive(Deserialize, Debug)]
struct SessionWordCountsData {
    user: u32,
    other: u32,
}

fn speaker_from_wire(s: Option<&str>) -> Speaker {
    match s {
        Some("user") => Speaker::User,
        _ => Speaker::Other,
    }
}

#[derive(Deserialize, Debug)]
struct SuggestionData {
    id: String,
    content: String,
    #[serde(rename = "suggestionType")]
    suggestion_type: String,
    timestamp: String,
    #[serde(default)]
    source: Option<String>,
    #[serde(default)]
    priority: Option<String>,
    #[serde(default)]
    buying_signal_type: Option<String>,
}

// ── Public API ─────────────────────────────────────────────────

#[derive(Clone)]
pub struct SuggestionFromServer {
    pub id: String,
    pub content: String,
    pub suggestion_type: String,
    pub timestamp: String,
    pub source: Option<String>,
    pub priority: Option<String>,
    pub buying_signal_type: Option<String>,
}

pub struct TranscriptionPipeline {
    backend_ws_url: String,
    auth_token: String,
    session_id: Uuid,
    product: String,
    mode: String,
    company_slug: Option<String>,
    runtime: Arc<RwLock<Option<PipelineRuntime>>>,
}

struct PipelineRuntime {
    shutdown_tx: tokio::sync::watch::Sender<bool>,
    audio_task: tokio::task::JoinHandle<()>,
    recv_task: tokio::task::JoinHandle<()>,
}

impl TranscriptionPipeline {
    pub fn new(
        backend_ws_url: String,
        auth_token: String,
        session_id: Uuid,
        session_mode: SessionMode,
        company_slug: Option<String>,
    ) -> Self {
        let (product, mode) = session_mode_to_ws_strings(session_mode);
        Self {
            backend_ws_url,
            auth_token,
            session_id,
            product,
            mode,
            company_slug,
            runtime: Arc::new(RwLock::new(None)),
        }
    }

    /// Starts the WebSocket pipeline and audio forwarding. Returns broadcast receivers for
    /// transcript segments and suggestions. Call [`Self::stop`] to shut down gracefully.
    /// When the server sends `session_ready`, the DB session id is forwarded via `backend_session_tx`.
    pub async fn start(
        &self,
        mut audio_rx: mpsc::Receiver<(Vec<f32>, u32)>,
        backend_session_tx: Option<mpsc::Sender<String>>,
    ) -> Result<
        (
            broadcast::Receiver<TranscriptSegment>,
            broadcast::Receiver<SuggestionFromServer>,
            broadcast::Receiver<CompetitorCardPayload>,
            broadcast::Receiver<SilenceDetectedPayload>,
        ),
        AppError,
    > {
        let mut guard = self.runtime.write().await;
        if guard.is_some() {
            return Err(AppError::Session(
                "Transcription pipeline already running".into(),
            ));
        }

        let (transcript_tx, transcript_rx) = broadcast::channel::<TranscriptSegment>(256);
        let (suggestion_tx, suggestion_rx) = broadcast::channel::<SuggestionFromServer>(64);
        let (competitor_tx, competitor_rx) = broadcast::channel::<CompetitorCardPayload>(64);
        let (silence_tx, silence_rx) = broadcast::channel::<SilenceDetectedPayload>(32);

        let (shutdown_tx, shutdown_rx) = tokio::sync::watch::channel(false);

        let ws_url = self.backend_ws_url.clone();
        let token = self.auth_token.clone();
        let product = self.product.clone();
        let mode = self.mode.clone();
        let company_slug = self.company_slug.clone();
        let session_id = self.session_id;

        let transcript_tx_a = transcript_tx.clone();
        let suggestion_tx_a = suggestion_tx.clone();
        let competitor_tx_a = competitor_tx.clone();
        let silence_tx_a = silence_tx.clone();
        let backend_session_tx_a = backend_session_tx.clone();

        let ws_connect = connect_with_retry(&ws_url).await?;
        let (mut ws_tx, mut ws_rx) = ws_connect.split();

        let start_msg = serde_json::to_string(&WsEvent {
            event: "start_session",
            data: StartSessionPayload {
                token,
                product,
                mode,
                company_slug,
            },
        })
        .map_err(|e| AppError::Internal(e.to_string()))?;

        ws_tx
            .send(Message::Text(start_msg))
            .await
            .map_err(|e| AppError::Network(e.to_string()))?;

        let mut shutdown_rx_audio = shutdown_rx.clone();
        let audio_task = tokio::spawn(async move {
            loop {
                tokio::select! {
                    biased;
                    _ = shutdown_rx_audio.changed() => {
                        if *shutdown_rx_audio.borrow() {
                            break;
                        }
                    }
                    chunk = audio_rx.recv() => {
                        match chunk {
                            Some((samples, sample_rate)) => {
                                let wav_bytes = encode_wav(&samples, sample_rate, 1);
                                let b64 = BASE64.encode(&wav_bytes);
                                let msg = serde_json::to_string(&WsEvent {
                                    event: "audio_chunk",
                                    data: AudioChunkPayload { audio: b64 },
                                });
                                match msg {
                                    Ok(text) => {
                                        if ws_tx.send(Message::Text(text)).await.is_err() {
                                            warn!("WebSocket send failed — stopping audio sender");
                                            break;
                                        }
                                    }
                                    Err(e) => error!("Failed to serialize audio chunk: {}", e),
                                }
                            }
                            None => break,
                        }
                    }
                }
            }
            let _ = ws_tx.send(Message::Close(None)).await;
            debug!("Audio sender task finished");
        });

        let mut shutdown_rx_recv = shutdown_rx.clone();
        let recv_task = tokio::spawn(async move {
            loop {
                tokio::select! {
                    biased;
                    _ = shutdown_rx_recv.changed() => {
                        if *shutdown_rx_recv.borrow() {
                            break;
                        }
                    }
                    msg = ws_rx.next() => {
                        match msg {
                            Some(Ok(Message::Text(text))) => {
                                match serde_json::from_str::<ServerMessage>(&text) {
                                    Ok(server_msg) => {
                                        handle_server_message(
                                            server_msg,
                                            session_id,
                                            &transcript_tx_a,
                                            &suggestion_tx_a,
                                            &competitor_tx_a,
                                            &silence_tx_a,
                                            &backend_session_tx_a,
                                        )
                                        .await;
                                    }
                                    Err(e) => warn!("Failed to parse server message: {}", e),
                                }
                            }
                            Some(Ok(Message::Close(_))) => {
                                info!("WebSocket closed by server");
                                break;
                            }
                            Some(Err(e)) => {
                                error!("WebSocket error: {}", e);
                                break;
                            }
                            Some(_) => {}
                            None => break,
                        }
                    }
                }
            }
            debug!("Receiver task finished");
        });

        *guard = Some(PipelineRuntime {
            shutdown_tx,
            audio_task,
            recv_task,
        });
        drop(guard);

        Ok((transcript_rx, suggestion_rx, competitor_rx, silence_rx))
    }

    /// Stops the pipeline: signals shutdown, waits for tasks, and clears runtime state.
    pub async fn stop(&self) -> Result<(), AppError> {
        let mut guard = self.runtime.write().await;
        if let Some(rt) = guard.take() {
            let _ = rt.shutdown_tx.send(true);
            let _ = tokio::join!(rt.audio_task, rt.recv_task);
        }
        Ok(())
    }
}

fn session_mode_to_ws_strings(mode: SessionMode) -> (String, String) {
    match mode {
        SessionMode::DevOracle(m) => (
            "DevOracle".to_string(),
            match m {
                InterviewMode::MockInterview => "mock_interview".to_string(),
                InterviewMode::BehavioralTech => "behavioral_tech".to_string(),
                InterviewMode::CodingInterview => "coding_interview".to_string(),
                InterviewMode::SystemDesign => "system_design".to_string(),
            },
        ),
        SessionMode::RingWise(m) => (
            "RingWise".to_string(),
            match m {
                CallMode::SalesCall => "sales_call".to_string(),
                CallMode::Discovery => "discovery".to_string(),
                CallMode::Demo => "demo".to_string(),
                CallMode::Negotiation => "negotiation".to_string(),
                CallMode::FollowUp => "follow_up".to_string(),
            },
        ),
    }
}

async fn connect_with_retry(
    url: &str,
) -> Result<WebSocketStream<MaybeTlsStream<tokio::net::TcpStream>>, AppError> {
    let delays_ms = [1000u64, 2000, 4000];
    let mut last_err = String::new();
    for attempt in 0..3 {
        match connect_async(url).await {
            Ok((stream, _)) => {
                info!("WebSocket connected to {} (attempt {})", url, attempt + 1);
                return Ok(stream);
            }
            Err(e) => {
                last_err = e.to_string();
                warn!(
                    "WebSocket connect failed (attempt {}): {}",
                    attempt + 1,
                    last_err
                );
                if attempt < 2 {
                    sleep(Duration::from_millis(delays_ms[attempt])).await;
                }
            }
        }
    }
    Err(AppError::Network(format!(
        "WebSocket connection failed after 3 attempts: {}",
        last_err
    )))
}

async fn handle_server_message(
    msg: ServerMessage,
    session_id: Uuid,
    transcript_tx: &broadcast::Sender<TranscriptSegment>,
    suggestion_tx: &broadcast::Sender<SuggestionFromServer>,
    competitor_tx: &broadcast::Sender<CompetitorCardPayload>,
    silence_tx: &broadcast::Sender<SilenceDetectedPayload>,
    backend_session_tx: &Option<mpsc::Sender<String>>,
) {
    match msg.event.as_str() {
        "transcript_segment" => {
            if let Ok(data) = serde_json::from_value::<TranscriptData>(msg.data) {
                let ts = chrono::DateTime::parse_from_rfc3339(&data.timestamp)
                    .map(|d| d.with_timezone(&chrono::Utc))
                    .unwrap_or_else(|_| chrono::Utc::now());
                let wc = data.word_count.unwrap_or(0);
                let swc = data
                    .session_word_counts
                    .map(|s| SessionWordCounts {
                        user: s.user,
                        other: s.other,
                    })
                    .unwrap_or(SessionWordCounts { user: 0, other: 0 });
                let ratio = data.talk_ratio_user.unwrap_or(0.0);
                let segment = TranscriptSegment {
                    id: Uuid::new_v4(),
                    session_id,
                    speaker: speaker_from_wire(data.speaker.as_deref()),
                    text: data.text,
                    timestamp: ts,
                    confidence: 0.9,
                    word_count: wc,
                    session_word_counts: swc,
                    talk_ratio_user: ratio,
                    vocal_metrics: data.vocal_metrics,
                };
                let _ = transcript_tx.send(segment);
                if let Some(comp) = data.competitor_detected {
                    let _ = competitor_tx.send(comp);
                }
            }
        }
        "suggestion" => {
            if let Ok(data) = serde_json::from_value::<SuggestionData>(msg.data) {
                let s = SuggestionFromServer {
                    id: data.id,
                    content: data.content,
                    suggestion_type: data.suggestion_type,
                    timestamp: data.timestamp,
                    source: data.source,
                    priority: data.priority,
                    buying_signal_type: data.buying_signal_type,
                };
                let _ = suggestion_tx.send(s);
            }
        }
        "silence_detected" => {
            if let Ok(data) = serde_json::from_value::<SilenceDetectedPayload>(msg.data) {
                let _ = silence_tx.send(data);
            }
        }
        "session_ready" => {
            if let Some(id) = msg.data.get("sessionId").and_then(|v| v.as_str()) {
                if let Some(tx) = backend_session_tx.as_ref() {
                    let _ = tx.try_send(id.to_string());
                }
            }
            info!("Session ready confirmed by backend");
        }
        "error" => {
            let m = msg.data["message"].as_str().unwrap_or("unknown");
            error!("Server error: {}", m);
        }
        other => debug!("Unhandled server event: {}", other),
    }
}

/// Encode raw f32 PCM samples as a minimal WAV file (bytes).
fn encode_wav(samples: &[f32], sample_rate: u32, channels: u16) -> Vec<u8> {
    let num_samples = samples.len() as u32;
    let bits_per_sample: u16 = 16;
    let byte_rate = sample_rate * u32::from(channels) * u32::from(bits_per_sample) / 8;
    let block_align = channels * bits_per_sample / 8;
    let data_size = num_samples * 2;

    let mut buf = Vec::with_capacity(44 + data_size as usize);

    buf.extend_from_slice(b"RIFF");
    buf.extend_from_slice(&(36 + data_size).to_le_bytes());
    buf.extend_from_slice(b"WAVE");

    buf.extend_from_slice(b"fmt ");
    buf.extend_from_slice(&16u32.to_le_bytes());
    buf.extend_from_slice(&1u16.to_le_bytes());
    buf.extend_from_slice(&channels.to_le_bytes());
    buf.extend_from_slice(&sample_rate.to_le_bytes());
    buf.extend_from_slice(&byte_rate.to_le_bytes());
    buf.extend_from_slice(&block_align.to_le_bytes());
    buf.extend_from_slice(&bits_per_sample.to_le_bytes());

    buf.extend_from_slice(b"data");
    buf.extend_from_slice(&data_size.to_le_bytes());
    for &s in samples {
        let v = (s.clamp(-1.0, 1.0) * 32767.0) as i16;
        buf.extend_from_slice(&v.to_le_bytes());
    }

    buf
}
