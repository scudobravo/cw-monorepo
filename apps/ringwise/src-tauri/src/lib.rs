mod commands;

use cw_core::StealthConfig;
use cw_session_engine::SessionEngine;
use cw_stealth::StealthCoordinator;
use std::sync::Arc;
use tauri::Manager;
use tokio::sync::Mutex;
use tracing_subscriber::EnvFilter;

pub struct AppState {
    pub session_engine: Arc<SessionEngine>,
    pub stealth_coordinator: Arc<StealthCoordinator>,
    pub(crate) audio_pipeline: Arc<Mutex<Option<commands::session::RunningPipeline>>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env().add_directive("cue=debug".parse().unwrap()))
        .init();

    let app_state = AppState {
        session_engine: Arc::new(SessionEngine::new()),
        stealth_coordinator: Arc::new(StealthCoordinator::new(StealthConfig::default())),
        audio_pipeline: Arc::new(Mutex::new(None)),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
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
        ])
        .setup(|app| {
            tracing::info!("Cue desktop starting up");
            let stealth: Arc<StealthCoordinator> =
                Arc::clone(&app.state::<AppState>().stealth_coordinator);
            tauri::async_runtime::spawn(async move {
                stealth.start().await;
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Cue");
}
