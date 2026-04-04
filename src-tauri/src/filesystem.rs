use serde::{Deserialize, Serialize};
use std::path::Path;
use walkdir::WalkDir;

/// Represents a node in the file tree (file or directory with children)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub extension: Option<String>,
    pub children: Option<Vec<FileNode>>,
}

/// Build a recursive file tree from a given root path
fn build_tree(root: &Path) -> Vec<FileNode> {
    let mut nodes: Vec<FileNode> = Vec::new();

    if let Ok(entries) = std::fs::read_dir(root) {
        let mut entries: Vec<_> = entries.filter_map(|e| e.ok()).collect();
        // Sort: directories first, then alphabetically
        entries.sort_by(|a, b| {
            let a_is_dir = a.file_type().map(|t| t.is_dir()).unwrap_or(false);
            let b_is_dir = b.file_type().map(|t| t.is_dir()).unwrap_or(false);
            match (a_is_dir, b_is_dir) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => a.file_name().cmp(&b.file_name()),
            }
        });

        for entry in entries {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();

            // Skip hidden files/directories
            if name.starts_with('.') {
                continue;
            }

            let is_dir = path.is_dir();
            let extension = if !is_dir {
                path.extension().map(|e| e.to_string_lossy().to_string())
            } else {
                None
            };

            let children = if is_dir {
                Some(build_tree(&path))
            } else {
                None
            };

            nodes.push(FileNode {
                name,
                path: path.to_string_lossy().to_string(),
                is_dir,
                extension,
                children,
            });
        }
    }

    nodes
}

/// List directory contents recursively, returning a tree structure
#[tauri::command]
pub fn list_directory(path: String) -> Result<Vec<FileNode>, String> {
    let root = Path::new(&path);
    if !root.exists() {
        return Err(format!("Path does not exist: {}", path));
    }
    if !root.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }
    Ok(build_tree(root))
}

/// Read a file's content as a UTF-8 string
#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))
}

/// Read a file as raw binary bytes (for PDFs, images, etc.)
#[tauri::command]
pub fn read_file_binary(path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&path).map_err(|e| format!("Failed to read binary file: {}", e))
}

/// Write content to a file (creates or overwrites)
#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<(), String> {
    // Ensure parent directory exists
    if let Some(parent) = Path::new(&path).parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directories: {}", e))?;
    }
    std::fs::write(&path, &content).map_err(|e| format!("Failed to write file: {}", e))
}

/// Create a new file with content
#[tauri::command]
pub fn create_file(path: String, content: String) -> Result<(), String> {
    let file_path = Path::new(&path);
    if file_path.exists() {
        return Err(format!("File already exists: {}", path));
    }
    write_file(path, content)
}

/// Get info about directory (file count, total size)
#[tauri::command]
pub fn get_directory_stats(path: String) -> Result<serde_json::Value, String> {
    let root = Path::new(&path);
    if !root.is_dir() {
        return Err("Not a directory".to_string());
    }

    let mut file_count: u64 = 0;
    let mut dir_count: u64 = 0;
    let mut total_size: u64 = 0;

    for entry in WalkDir::new(root).into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {
            file_count += 1;
            if let Ok(meta) = entry.metadata() {
                total_size += meta.len();
            }
        } else if entry.file_type().is_dir() {
            dir_count += 1;
        }
    }

    Ok(serde_json::json!({
        "file_count": file_count,
        "dir_count": dir_count - 1, // exclude root
        "total_size": total_size,
    }))
}

#[tauri::command]
pub fn write_file_binary(path: String, content: Vec<u8>) -> Result<(), String> {
    use std::fs;
    if let Some(parent) = Path::new(&path).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directories: {}", e))?;
    }
    fs::write(&path, content).map_err(|e| format!("Failed to write binary file: {}", e))
}
