use crate::AppState;
use cw_core::{AppError, StealthConfig};
use tauri::State;

#[tauri::command]
pub async fn get_stealth_config(state: State<'_, AppState>) -> Result<StealthConfig, AppError> {
    Ok(state.stealth_coordinator.get_config().await)
}

#[tauri::command]
pub async fn update_stealth_config(
    state: State<'_, AppState>,
    config: StealthConfig,
) -> Result<(), AppError> {
    state.stealth_coordinator.update_config(config).await;
    Ok(())
}

#[tauri::command]
pub async fn toggle_stealth(state: State<'_, AppState>) -> Result<bool, AppError> {
    let current = state.stealth_coordinator.is_active().await;
    state.stealth_coordinator.set_active(!current).await;
    Ok(!current)
}

#[tauri::command]
pub async fn get_stealth_state(state: State<'_, AppState>) -> Result<bool, AppError> {
    Ok(state.stealth_coordinator.is_active().await)
}
