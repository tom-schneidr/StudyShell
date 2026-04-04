use notify::{RecommendedWatcher, RecursiveMode};
use notify_debouncer_mini::new_debouncer;
use serde::Serialize;
use std::path::Path;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

/// Event payload sent to the frontend when the filesystem changes
#[derive(Debug, Clone, Serialize)]
pub struct FsChangeEvent {
    pub path: String,
    pub kind: String,
}

/// State that holds the watcher handle so we can stop it later
pub struct WatcherState {
    pub watcher: Mutex<Option<notify_debouncer_mini::Debouncer<RecommendedWatcher>>>,
    pub watched_path: Mutex<Option<String>>,
}

impl WatcherState {
    pub fn new() -> Self {
        Self {
            watcher: Mutex::new(None),
            watched_path: Mutex::new(None),
        }
    }
}

/// Start watching a directory for changes
#[tauri::command]
pub fn start_watching(
    app: AppHandle,
    state: tauri::State<'_, WatcherState>,
    path: String,
) -> Result<(), String> {
    // Stop any existing watcher first
    {
        let mut watcher_guard = state.watcher.lock().map_err(|e| e.to_string())?;
        *watcher_guard = None;
    }

    let watch_path = path.clone();
    let app_handle = app.clone();

    // Create a debounced watcher (250ms debounce)
    let mut debouncer = new_debouncer(
        Duration::from_millis(250),
        move |result: Result<Vec<notify_debouncer_mini::DebouncedEvent>, notify::Error>| {
            match result {
                Ok(events) => {
                    for event in events {
                        let change_event = FsChangeEvent {
                            path: event.path.to_string_lossy().to_string(),
                            kind: format!("{:?}", event.kind),
                        };
                        let _ = app_handle.emit("fs-changed", &change_event);
                    }
                }
                Err(e) => {
                    log::error!("Watch error: {:?}", e);
                }
            }
        },
    )
    .map_err(|e| format!("Failed to create watcher: {}", e))?;

    // Start watching the path recursively
    debouncer
        .watcher()
        .watch(Path::new(&watch_path), RecursiveMode::Recursive)
        .map_err(|e| format!("Failed to watch path: {}", e))?;

    // Store the watcher
    {
        let mut watcher_guard = state.watcher.lock().map_err(|e| e.to_string())?;
        *watcher_guard = Some(debouncer);
    }
    {
        let mut path_guard = state.watched_path.lock().map_err(|e| e.to_string())?;
        *path_guard = Some(path);
    }

    Ok(())
}

/// Stop watching the filesystem
#[tauri::command]
pub fn stop_watching(state: tauri::State<'_, WatcherState>) -> Result<(), String> {
    let mut watcher_guard = state.watcher.lock().map_err(|e| e.to_string())?;
    *watcher_guard = None;

    let mut path_guard = state.watched_path.lock().map_err(|e| e.to_string())?;
    *path_guard = None;

    Ok(())
}
