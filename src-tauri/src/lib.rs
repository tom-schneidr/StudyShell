mod filesystem;
mod vertex_client;
mod watcher;

use vertex_client::VertexState;
use watcher::WatcherState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load .env file if present
    let _ = dotenvy::dotenv();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(WatcherState::new())
        .manage(VertexState::new())
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
            // Vertex AI commands
            vertex_client::chat_with_ai,
            vertex_client::summarize_files,
            vertex_client::generate_study_guide,
            vertex_client::check_vertex_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
