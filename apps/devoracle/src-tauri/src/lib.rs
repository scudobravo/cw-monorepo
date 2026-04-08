mod commands;

use cw_core::StealthConfig;
use cw_session_engine::SessionEngine;
use cw_stealth::StealthCoordinator;
use std::sync::Arc;
use tauri::Manager;
use tauri_plugin_global_shortcut::ShortcutState;
use tokio::sync::Mutex;
use tracing_subscriber::EnvFilter;

/// Application state managed by Tauri
pub struct AppState {
    pub session_engine: Arc<SessionEngine>,
    pub stealth_coordinator: Arc<StealthCoordinator>,
    pub(crate) audio_pipeline: Arc<Mutex<Option<commands::session::RunningPipeline>>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::from_default_env().add_directive("codewhisper=debug".parse().unwrap()),
        )
        .init();

    let app_state = AppState {
        session_engine: Arc::new(SessionEngine::new()),
        stealth_coordinator: Arc::new(StealthCoordinator::new(StealthConfig::default())),
        audio_pipeline: Arc::new(Mutex::new(None)),
    };

    let global_shortcut_plugin = tauri_plugin_global_shortcut::Builder::new()
        .with_shortcut("CommandOrControl+Shift+O")
        .expect("register overlay toggle shortcut")
        .with_handler(|app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                let app = app.clone();
                tauri::async_runtime::spawn(async move {
                    let _ = commands::overlay::toggle_overlay(app).await;
                });
            }
        })
        .build();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(global_shortcut_plugin)
        .plugin(tauri_plugin_notification::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            commands::session::start_session,
            commands::session::stop_session,
            commands::session::get_session_state,
            commands::session::start_audio_pipeline,
            commands::session::stop_audio_pipeline,
            commands::audio::list_audio_devices,
            commands::audio::test_audio,
            commands::stealth::get_stealth_config,
            commands::stealth::update_stealth_config,
            commands::stealth::toggle_stealth,
            commands::stealth::get_stealth_state,
            commands::settings::get_app_version,
            commands::settings::quit_app,
            commands::overlay::open_overlay,
            commands::overlay::close_overlay,
            commands::overlay::toggle_overlay,
            commands::problem::detect_leetcode_problem,
        ])
        .setup(|app| {
            tracing::info!("Savant desktop starting up");

            // Clone the Arc so the spawned task owns it independently
            let stealth: Arc<StealthCoordinator> =
                Arc::clone(&app.state::<AppState>().stealth_coordinator);
            tauri::async_runtime::spawn(async move {
                stealth.start().await;
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Savant");
}
