//! Floating transparent overlay window (DevOracle code hints).

use tauri::{AppHandle, Manager, WebviewUrl};
use tauri::webview::WebviewWindowBuilder;

#[tauri::command]
pub async fn open_overlay(app: AppHandle) -> Result<(), String> {
    if app.get_webview_window("overlay").is_some() {
        return Ok(());
    }

    let _overlay = WebviewWindowBuilder::new(&app, "overlay", WebviewUrl::App("/overlay".into()))
        .title("DevOracle Overlay")
        .transparent(true)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(true)
        .inner_size(420.0, 600.0)
        .content_protected(true)
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn close_overlay(app: AppHandle) {
    if let Some(w) = app.get_webview_window("overlay") {
        let _ = w.close();
    }
}

#[tauri::command]
pub async fn toggle_overlay(app: AppHandle) -> Result<bool, String> {
    match app.get_webview_window("overlay") {
        Some(w) => {
            let _ = w.close();
            Ok(false)
        }
        None => {
            open_overlay(app).await?;
            Ok(true)
        }
    }
}
