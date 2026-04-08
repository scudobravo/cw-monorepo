use cw_audio_capture::device::{list_input_devices, AudioDevice};
use cw_core::AppError;

#[tauri::command]
pub fn list_audio_devices() -> Result<Vec<AudioDevice>, AppError> {
    list_input_devices().map_err(|e| e.into())
}

#[tauri::command]
pub fn test_audio() -> Result<bool, AppError> {
    // TODO: Record a brief audio sample and verify it's not silent
    let devices = list_input_devices().map_err(|e| AppError::from(e))?;
    Ok(!devices.is_empty())
}
