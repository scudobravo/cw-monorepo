use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{SampleFormat, StreamConfig};
use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::{error, info};

use crate::AudioError;

/// Audio chunk sent to the transcription pipeline
pub struct AudioChunk {
    pub samples: Vec<f32>,
    pub sample_rate: u32,
    pub channels: u16,
}

/// Starts capturing audio from the default input device.
/// Returns a receiver that yields audio chunks.
pub fn start_capture(
    device_name: Option<&str>,
) -> Result<(mpsc::Receiver<AudioChunk>, CaptureHandle), AudioError> {
    let host = cpal::default_host();

    let device = if let Some(name) = device_name {
        host.input_devices()
            .map_err(|e| AudioError::DeviceError(e.to_string()))?
            .find(|d| d.name().map(|n| n == name).unwrap_or(false))
            .ok_or_else(|| AudioError::DeviceError(format!("Device '{}' not found", name)))?
    } else {
        host.default_input_device()
            .ok_or(AudioError::NoInputDevice)?
    };

    let config = device
        .default_input_config()
        .map_err(|e| AudioError::DeviceError(e.to_string()))?;

    let sample_rate = config.sample_rate().0;
    let channels = config.channels();
    let sample_format = config.sample_format();

    let (tx, rx) = mpsc::channel::<AudioChunk>(64);

    let stream_config: StreamConfig = config.into();
    let tx = Arc::new(tx);

    let stream = match sample_format {
        SampleFormat::F32 => {
            let tx = tx.clone();
            device.build_input_stream(
                &stream_config,
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    let chunk = AudioChunk {
                        samples: data.to_vec(),
                        sample_rate,
                        channels,
                    };
                    let _ = tx.try_send(chunk);
                },
                move |err| error!("Audio stream error: {}", err),
                None,
            )
        }
        _ => {
            return Err(AudioError::DeviceError(format!(
                "Unsupported sample format: {:?}",
                sample_format
            )));
        }
    }
    .map_err(|e| AudioError::StreamError(e.to_string()))?;

    stream
        .play()
        .map_err(|e| AudioError::StreamError(e.to_string()))?;

    info!(
        "Audio capture started: {}Hz, {} channels",
        sample_rate, channels
    );

    Ok((rx, CaptureHandle { _stream: stream }))
}

/// Handle that keeps the audio stream alive. Drop to stop capture.
pub struct CaptureHandle {
    _stream: cpal::Stream,
}
