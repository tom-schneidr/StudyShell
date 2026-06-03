mod ai_client;
mod filesystem;
mod watcher;

use ai_client::AiClientState;
use watcher::WatcherState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn create_app() -> tauri::Builder<tauri::Wry> {
    // Load .env file if present
    let _ = dotenvy::dotenv();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(WatcherState::new())
        .manage(AiClientState::new())
        .invoke_handler(tauri::generate_handler![
            // Filesystem commands
            filesystem::list_directory,
            filesystem::read_file,
            filesystem::read_file_binary,
            filesystem::write_file,
            filesystem::write_file_binary,
            filesystem::create_file,
            filesystem::create_directory,
            filesystem::delete_file,
            filesystem::delete_directory,
            filesystem::rename_entry,
            filesystem::import_files,
            filesystem::search_files,
            filesystem::save_base64_asset,
            filesystem::get_directory_stats,
            // Watcher commands
            watcher::start_watching,
            watcher::stop_watching,
            // FreeRouter / OpenAI-compatible AI commands
            ai_client::chat_with_ai,
            ai_client::summarize_files,
            ai_client::generate_study_guide,
            ai_client::stream_chat_with_ai,
            ai_client::get_ai_status,
            ai_client::check_ai_config,
        ])
}
