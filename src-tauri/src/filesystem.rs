use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
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

/// Create a new directory
#[tauri::command]
pub fn create_directory(path: String) -> Result<(), String> {
    let directory_path = Path::new(&path);
    if directory_path.exists() {
        return Err(format!("Directory already exists: {}", path));
    }

    std::fs::create_dir_all(directory_path)
        .map_err(|e| format!("Failed to create directory: {}", e))
}

/// Delete a file from disk
#[tauri::command]
pub fn delete_file(path: String) -> Result<(), String> {
    let file_path = Path::new(&path);
    if !file_path.exists() {
        return Err(format!("File does not exist: {}", path));
    }
    if file_path.is_dir() {
        return Err(format!("Path is a directory, not a file: {}", path));
    }
    std::fs::remove_file(file_path).map_err(|e| format!("Failed to delete file: {}", e))
}

/// Delete a directory and all its contents from disk
#[tauri::command]
pub fn delete_directory(path: String) -> Result<(), String> {
    let dir_path = Path::new(&path);
    if !dir_path.exists() {
        return Err(format!("Directory does not exist: {}", path));
    }
    if !dir_path.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }
    std::fs::remove_dir_all(dir_path).map_err(|e| format!("Failed to delete directory: {}", e))
}

/// Rename (or move) a file or directory
#[tauri::command]
pub fn rename_entry(old_path: String, new_path: String) -> Result<(), String> {
    let source = Path::new(&old_path);
    let target = Path::new(&new_path);

    if !source.exists() {
        return Err(format!("Source does not exist: {}", old_path));
    }
    if target.exists() {
        return Err(format!("Target already exists: {}", new_path));
    }

    // Ensure parent directory of target exists
    if let Some(parent) = target.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directories for target: {}", e))?;
    }

    std::fs::rename(source, target).map_err(|e| format!("Failed to rename entry: {}", e))
}

/// Copy external files/folders into a target workspace directory
#[tauri::command]
pub fn import_files(paths: Vec<String>, target_dir: String) -> Result<(), String> {
    let target_dir_path = Path::new(&target_dir);
    if !target_dir_path.exists() || !target_dir_path.is_dir() {
        return Err(format!(
            "Target directory does not exist or is not a directory: {}",
            target_dir
        ));
    }

    for path_str in paths {
        let source_path = Path::new(&path_str);
        if !source_path.exists() {
            continue;
        }

        let file_name = source_path
            .file_name()
            .ok_or_else(|| format!("Invalid source path: {}", path_str))?;
        let requested_dest_path = target_dir_path.join(file_name);
        let dest_path = resolve_unique_destination_path(&requested_dest_path);

        if source_path.is_dir() {
            copy_dir_recursive(source_path, &dest_path)?;
        } else {
            std::fs::copy(source_path, &dest_path)
                .map_err(|e| format!("Failed to copy file {}: {}", path_str, e))?;
        }
    }

    Ok(())
}

fn resolve_unique_destination_path(path: &Path) -> PathBuf {
    if !path.exists() {
        return path.to_path_buf();
    }

    let parent = path.parent().unwrap_or_else(|| Path::new(""));
    let file_name = path
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_else(|| "imported-item".to_string());
    let stem = if path.is_dir() {
        file_name.clone()
    } else {
        path.file_stem()
            .map(|name| name.to_string_lossy().to_string())
            .filter(|name| !name.is_empty())
            .unwrap_or(file_name.clone())
    };
    let extension = if path.is_dir() {
        None
    } else {
        path.extension()
            .map(|ext| ext.to_string_lossy().to_string())
    };

    let mut index = 2;
    loop {
        let candidate_name = match &extension {
            Some(ext) if !ext.is_empty() => format!("{stem}-{index}.{ext}"),
            _ => format!("{stem}-{index}"),
        };
        let candidate = parent.join(candidate_name);
        if !candidate.exists() {
            return candidate;
        }
        index += 1;
    }
}

fn copy_dir_recursive(source: &Path, dest: &Path) -> Result<(), String> {
    std::fs::create_dir_all(dest)
        .map_err(|e| format!("Failed to create directory {}: {}", dest.display(), e))?;

    for entry in std::fs::read_dir(source).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let file_type = entry.file_type().map_err(|e| e.to_string())?;
        if file_type.is_dir() {
            copy_dir_recursive(&entry.path(), &dest.join(entry.file_name()))?;
        } else {
            std::fs::copy(entry.path(), dest.join(entry.file_name()))
                .map_err(|e| format!("Failed to copy file: {}", e))?;
        }
    }
    Ok(())
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub path: String,
    pub line_number: usize,
    pub content: String,
}

/// Recursively search for a query string in text files within a directory
#[tauri::command]
pub fn search_files(path: String, query: String) -> Result<Vec<SearchResult>, String> {
    let root = Path::new(&path);
    if !root.exists() || !root.is_dir() {
        return Err(format!("Invalid search root: {}", path));
    }

    let mut results = Vec::new();
    let query_lower = query.to_lowercase();

    // Iterate through all files in the directory
    for entry in WalkDir::new(root).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();

        // Only search files, not directories
        if !path.is_file() {
            continue;
        }

        // Skip hidden files
        if path
            .file_name()
            .map(|n| n.to_string_lossy().starts_with('.'))
            .unwrap_or(false)
        {
            continue;
        }

        // Limit search to files < 1MB to preserve performance
        let metadata = path.metadata().map_err(|e| e.to_string())?;
        if metadata.len() > 1_000_000 {
            continue;
        }

        // Try reading as UTF-8. If it fails, skip (likely a binary file)
        if let Ok(content) = std::fs::read_to_string(path) {
            for (index, line) in content.lines().enumerate() {
                if line.to_lowercase().contains(&query_lower) {
                    results.push(SearchResult {
                        path: path.to_string_lossy().to_string(),
                        line_number: index + 1,
                        content: line.trim().to_string(),
                    });
                }

                // Cap results per search session to prevent UI from locking up
                if results.len() > 200 {
                    return Ok(results);
                }
            }
        }
    }

    Ok(results)
}

#[tauri::command]
pub fn write_file_binary(path: String, content: Vec<u8>) -> Result<(), String> {
    use std::fs;
    if let Some(parent) = Path::new(&path).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directories: {}", e))?;
    }
    fs::write(&path, content).map_err(|e| format!("Failed to write binary file: {}", e))
}

#[tauri::command]
pub fn save_base64_asset(
    document_path: String,
    filename: String,
    base64_data: String,
) -> Result<String, String> {
    use base64::{engine::general_purpose, Engine as _};
    use std::fs;

    let document = Path::new(&document_path);
    let document_dir = document
        .parent()
        .ok_or_else(|| format!("Document path has no parent directory: {}", document_path))?;
    let assets_dir = document_dir.join("_assets");

    if !assets_dir.exists() {
        fs::create_dir_all(&assets_dir)
            .map_err(|e| format!("Failed to create assets directory: {}", e))?;
    }

    let file_path = resolve_unique_destination_path(&assets_dir.join(&filename));

    // Decode base64. Handle potential header (e.g. "data:image/png;base64,")
    let clean_data = if base64_data.contains(",") {
        base64_data.split(",").nth(1).unwrap_or(&base64_data)
    } else {
        &base64_data
    };

    let bytes = general_purpose::STANDARD
        .decode(clean_data)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;

    fs::write(&file_path, bytes).map_err(|e| format!("Failed to save asset: {}", e))?;

    // Return the relative path for easy relative links in markdown
    let relative_name = file_path
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .ok_or_else(|| "Saved asset path was missing a filename".to_string())?;
    Ok(format!("_assets/{}", relative_name))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::time::{SystemTime, UNIX_EPOCH};

    struct TestDir {
        path: PathBuf,
    }

    impl TestDir {
        fn new(prefix: &str) -> Self {
            let unique = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("system time should be after unix epoch")
                .as_nanos();
            let path = std::env::temp_dir().join(format!("studyshell-{prefix}-{unique}"));
            fs::create_dir_all(&path).expect("failed to create temp test dir");
            Self { path }
        }

        fn path(&self) -> &Path {
            &self.path
        }

        fn child(&self, relative: &str) -> PathBuf {
            self.path.join(relative)
        }
    }

    impl Drop for TestDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.path);
        }
    }

    #[test]
    fn list_directory_sorts_entries_and_skips_hidden_items() {
        let temp = TestDir::new("tree");

        fs::create_dir_all(temp.child("b-folder")).unwrap();
        fs::create_dir_all(temp.child("a-folder")).unwrap();
        fs::create_dir_all(temp.child(".hidden-folder")).unwrap();
        fs::write(temp.child("zeta.md"), "# notes").unwrap();
        fs::write(temp.child("alpha.txt"), "hello").unwrap();
        fs::write(temp.child(".env"), "SECRET=1").unwrap();

        let tree = list_directory(temp.path().to_string_lossy().to_string()).unwrap();
        let names: Vec<_> = tree.iter().map(|node| node.name.as_str()).collect();

        assert_eq!(names, vec!["a-folder", "b-folder", "alpha.txt", "zeta.md"]);
        assert!(tree.iter().all(|node| !node.name.starts_with('.')));
        assert_eq!(tree[0].is_dir, true);
        assert_eq!(tree[2].extension.as_deref(), Some("txt"));
    }

    #[test]
    fn create_and_write_file_create_parent_directories() {
        let temp = TestDir::new("write");
        let nested_path = temp.child("course/week1/notes.md");

        create_file(
            nested_path.to_string_lossy().to_string(),
            "initial".to_string(),
        )
        .unwrap();

        let content = fs::read_to_string(&nested_path).unwrap();
        assert_eq!(content, "initial");

        write_file(
            nested_path.to_string_lossy().to_string(),
            "updated".to_string(),
        )
        .unwrap();

        let updated = fs::read_to_string(&nested_path).unwrap();
        assert_eq!(updated, "updated");
    }

    #[test]
    fn get_directory_stats_counts_visible_and_hidden_files_on_disk() {
        let temp = TestDir::new("stats");

        fs::create_dir_all(temp.child("module/week1")).unwrap();
        fs::write(temp.child("module/week1/lecture.md"), "abc").unwrap();
        fs::write(temp.child("module/week1/quiz.txt"), "12345").unwrap();
        fs::write(temp.child(".hidden"), "ignored-by-tree-but-on-disk").unwrap();

        let stats = get_directory_stats(temp.path().to_string_lossy().to_string()).unwrap();

        assert_eq!(stats["file_count"], 3);
        assert_eq!(stats["dir_count"], 2);
        assert!(stats["total_size"].as_u64().unwrap() >= 8);
    }

    #[test]
    fn create_directory_builds_nested_folders_and_rejects_duplicates() {
        let temp = TestDir::new("directory");
        let nested_dir = temp.child("course/week2/resources");

        create_directory(nested_dir.to_string_lossy().to_string()).unwrap();
        assert!(nested_dir.is_dir());

        let error = create_directory(nested_dir.to_string_lossy().to_string()).unwrap_err();
        assert!(error.contains("already exists"));
    }

    #[test]
    fn delete_file_removes_file_and_rejects_missing_or_directory() {
        let temp = TestDir::new("delfile");
        let file = temp.child("notes.md");
        fs::write(&file, "# Notes").unwrap();
        assert!(file.exists());

        delete_file(file.to_string_lossy().to_string()).unwrap();
        assert!(!file.exists());

        // Deleting again should error
        let error = delete_file(file.to_string_lossy().to_string()).unwrap_err();
        assert!(error.contains("does not exist"));

        // Trying to delete a directory as a file should error
        let dir = temp.child("subdir");
        fs::create_dir_all(&dir).unwrap();
        let error = delete_file(dir.to_string_lossy().to_string()).unwrap_err();
        assert!(error.contains("directory, not a file"));
    }

    #[test]
    fn delete_directory_removes_recursively_and_rejects_missing_or_file() {
        let temp = TestDir::new("deldir");
        let dir = temp.child("course/week1");
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("lecture.md"), "content").unwrap();
        fs::write(dir.join("quiz.txt"), "answers").unwrap();

        // Delete the parent "course" directory recursively
        let course_dir = temp.child("course");
        delete_directory(course_dir.to_string_lossy().to_string()).unwrap();
        assert!(!course_dir.exists());

        // Deleting again should error
        let error = delete_directory(course_dir.to_string_lossy().to_string()).unwrap_err();
        assert!(error.contains("does not exist"));

        // Trying to delete a file as a directory should error
        let file = temp.child("stray.txt");
        fs::write(&file, "data").unwrap();
        let error = delete_directory(file.to_string_lossy().to_string()).unwrap_err();
        assert!(error.contains("not a directory"));
    }

    #[test]
    fn rename_entry_safely_renames_and_prevents_overwrite() {
        let temp = TestDir::new("rename");
        let file = temp.child("old_name.md");
        fs::write(&file, "content").unwrap();

        let new_file = temp.child("new_name.md");

        // Success case
        rename_entry(
            file.to_string_lossy().to_string(),
            new_file.to_string_lossy().to_string(),
        )
        .unwrap();
        assert!(!file.exists());
        assert!(new_file.exists());
        assert_eq!(fs::read_to_string(&new_file).unwrap(), "content");

        // Target already exists
        let another = temp.child("another.md");
        fs::write(&another, "conflict").unwrap();

        let error = rename_entry(
            another.to_string_lossy().to_string(),
            new_file.to_string_lossy().to_string(),
        )
        .unwrap_err();
        assert!(error.contains("Target already exists"));

        // Source does not exist
        let error = rename_entry(
            temp.child("missing.md").to_string_lossy().to_string(),
            temp.child("target.md").to_string_lossy().to_string(),
        )
        .unwrap_err();
        assert!(error.contains("Source does not exist"));
    }

    #[test]
    fn import_files_avoids_overwriting_existing_files() {
        let workspace = TestDir::new("import-files-workspace");
        let source = TestDir::new("import-files-source");
        let incoming_file = source.child("notes.md");

        fs::write(workspace.child("notes.md"), "existing").unwrap();
        fs::write(&incoming_file, "incoming").unwrap();

        import_files(
            vec![incoming_file.to_string_lossy().to_string()],
            workspace.path().to_string_lossy().to_string(),
        )
        .unwrap();

        assert_eq!(
            fs::read_to_string(workspace.child("notes.md")).unwrap(),
            "existing"
        );
        assert_eq!(
            fs::read_to_string(workspace.child("notes-2.md")).unwrap(),
            "incoming"
        );
    }

    #[test]
    fn import_files_avoids_overwriting_existing_directories() {
        let workspace = TestDir::new("import-dirs-workspace");
        let source = TestDir::new("import-dirs-source");
        let source_dir = source.child("week1");

        fs::create_dir_all(workspace.child("week1")).unwrap();
        fs::write(workspace.child("week1/original.txt"), "keep").unwrap();

        fs::create_dir_all(source_dir.join("assets")).unwrap();
        fs::write(source_dir.join("lecture.md"), "imported notes").unwrap();
        fs::write(source_dir.join("assets/diagram.txt"), "diagram").unwrap();

        import_files(
            vec![source_dir.to_string_lossy().to_string()],
            workspace.path().to_string_lossy().to_string(),
        )
        .unwrap();

        assert!(workspace.child("week1/original.txt").exists());
        assert_eq!(
            fs::read_to_string(workspace.child("week1-2/lecture.md")).unwrap(),
            "imported notes"
        );
        assert_eq!(
            fs::read_to_string(workspace.child("week1-2/assets/diagram.txt")).unwrap(),
            "diagram"
        );
    }

    #[test]
    fn save_base64_asset_uses_document_directory_and_avoids_collisions() {
        let temp = TestDir::new("assets");
        let document = temp.child("course/week1/notes.md");
        let assets_dir = temp.child("course/week1/_assets");

        fs::create_dir_all(document.parent().unwrap()).unwrap();
        fs::write(&document, "# Notes").unwrap();
        fs::create_dir_all(&assets_dir).unwrap();
        fs::write(assets_dir.join("pasted-image-1.png"), b"existing").unwrap();

        let saved_path = save_base64_asset(
            document.to_string_lossy().to_string(),
            "pasted-image-1.png".to_string(),
            "data:image/png;base64,aGVsbG8=".to_string(),
        )
        .unwrap();

        assert_eq!(saved_path, "_assets/pasted-image-1-2.png");
        assert_eq!(
            fs::read(assets_dir.join("pasted-image-1.png")).unwrap(),
            b"existing"
        );
        assert_eq!(
            fs::read(assets_dir.join("pasted-image-1-2.png")).unwrap(),
            b"hello"
        );
    }
}
