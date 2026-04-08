use cw_core::AppError;
use tauri::AppHandle;

#[tauri::command]
pub fn get_app_version() -> Result<String, AppError> {
    Ok(env!("CARGO_PKG_VERSION").to_string())
}

#[tauri::command]
pub fn quit_app(app: AppHandle) {
    app.exit(0);
}
