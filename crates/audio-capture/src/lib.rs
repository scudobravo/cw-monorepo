pub mod capture;
pub mod device;

use cw_core::AppError;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AudioError {
    #[error("No input device available")]
    NoInputDevice,
    #[error("Device error: {0}")]
    DeviceError(String),
    #[error("Stream error: {0}")]
    StreamError(String),
    #[error("Permission denied")]
    PermissionDenied,
}

impl From<AudioError> for AppError {
    fn from(e: AudioError) -> Self {
        AppError::Audio(e.to_string())
    }
}
