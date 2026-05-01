import { useState, useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import type { DirectoryStats, FileNode, FsChangeEvent } from "../types";
import { STORAGE_KEYS, parseStoredRootPath } from "../utils/appPreferences";

export function useFileSystem() {
  const [rootPath, setRootPath] = useState<string | null>(() =>
    parseStoredRootPath(window.localStorage.getItem(STORAGE_KEYS.rootPath)),
  );
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [directoryStats, setDirectoryStats] = useState<DirectoryStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unlistenRef = useRef<(() => void) | null>(null);
  const initialRootPathRef = useRef(rootPath);

  // Select a root folder using the native dialog
  const selectRootFolder = useCallback(async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select your study root folder",
      });

      if (selected && typeof selected === "string") {
        await invoke("stop_watching");
        setRootPath(selected);
        await refreshTree(selected);
        // Start watching the directory
        await invoke("start_watching", { path: selected });
      }
    } catch (e) {
      setError(`Failed to select folder: ${e}`);
    }
  }, []);

  useEffect(() => {
    if (rootPath) {
      window.localStorage.setItem(STORAGE_KEYS.rootPath, rootPath);
      return;
    }

    window.localStorage.removeItem(STORAGE_KEYS.rootPath);
  }, [rootPath]);

  // Refresh the file tree from a given root
  const refreshTree = useCallback(async (path?: string) => {
    const targetPath = path || rootPath;
    if (!targetPath) return;

    setLoading(true);
    setStatsLoading(true);
    setError(null);
    try {
      const [tree, stats] = await Promise.all([
        invoke<FileNode[]>("list_directory", {
          path: targetPath,
        }),
        invoke<DirectoryStats>("get_directory_stats", {
          path: targetPath,
        }),
      ]);
      setFileTree(tree);
      setDirectoryStats(stats);
    } catch (e) {
      setError(`Failed to load directory: ${e}`);
      setDirectoryStats(null);
    } finally {
      setLoading(false);
      setStatsLoading(false);
    }
  }, [rootPath]);

  // Read a file's content
  const readFile = useCallback(async (path: string): Promise<string> => {
    return invoke<string>("read_file", { path });
  }, []);

  // Read a file as binary (for PDFs)
  const readFileBinary = useCallback(async (path: string): Promise<Uint8Array> => {
    const data = await invoke<number[]>("read_file_binary", { path });
    return new Uint8Array(data);
  }, []);

  // Write content to a file
  const writeFile = useCallback(
    async (path: string, content: string): Promise<void> => {
      return invoke("write_file", { path, content });
    },
    []
  );

  // Write binary data to a file
  const writeFileBinary = useCallback(
    async (path: string, content: Uint8Array): Promise<void> => {
      // Convert Uint8Array to number array for Tauri bridge
      return invoke("write_file_binary", { path, content: Array.from(content) });
    },
    []
  );

  // Create a new file
  const createFile = useCallback(
    async (path: string, content: string): Promise<void> => {
      return invoke("create_file", { path, content });
    },
    []
  );

  const createDirectory = useCallback(
    async (path: string): Promise<void> => {
      return invoke("create_directory", { path });
    },
    []
  );

  // Delete a file or directory
  const deleteEntry = useCallback(
    async (path: string, isDir: boolean): Promise<void> => {
      const command = isDir ? "delete_directory" : "delete_file";
      return invoke(command, { path });
    },
    []
  );

  // Rename a file or directory
  const renameEntry = useCallback(
    async (oldPath: string, newPath: string): Promise<void> => {
      return invoke("rename_entry", { oldPath, newPath });
    },
    []
  );

  const importFiles = useCallback(
    async (paths: string[], targetDir: string): Promise<void> => {
      return invoke("import_files", { paths, targetDir });
    },
    []
  );

  const searchFiles = useCallback(
    async (query: string): Promise<any[]> => {
      if (!rootPath) return [];
      return invoke<any[]>("search_files", { path: rootPath, query });
    },
    [rootPath]
  );

  const saveImageAsset = useCallback(
    async (documentPath: string, filename: string, base64Data: string): Promise<string> => {
      return invoke<string>("save_base64_asset", { documentPath, filename, base64Data });
    },
    []
  );

  // Listen for filesystem changes
  useEffect(() => {
    let mounted = true;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const setupListener = async () => {
      const unlisten = await listen<FsChangeEvent>("fs-changed", () => {
        if (mounted && rootPath) {
          // Debounce refresh to batch rapid changes
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            if (mounted) refreshTree();
          }, 300);
        }
      });
      unlistenRef.current = unlisten;
    };

    setupListener();

    return () => {
      mounted = false;
      if (debounceTimer) clearTimeout(debounceTimer);
      if (unlistenRef.current) {
        unlistenRef.current();
      }
      void invoke("stop_watching").catch((error) => {
        console.error("Failed to stop watcher:", error);
      });
    };
  }, [rootPath, refreshTree]);

  useEffect(() => {
    const restoredRootPath = initialRootPathRef.current;
    if (!restoredRootPath || rootPath !== restoredRootPath) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        await refreshTree(restoredRootPath);
        await invoke("start_watching", { path: restoredRootPath });
      } catch (restoreError) {
        if (cancelled) {
          return;
        }

        setError(`Failed to restore workspace: ${restoreError}`);
        setDirectoryStats(null);
        setFileTree([]);
        setRootPath(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshTree, rootPath]);

  return {
    rootPath,
    fileTree,
    directoryStats,
    loading,
    statsLoading,
    error,
    selectRootFolder,
    refreshTree,
    readFile,
    readFileBinary,
    writeFile,
    writeFileBinary,
    createFile,
    createDirectory,
    deleteEntry,
    renameEntry,
    importFiles,
    searchFiles,
    saveImageAsset,
  };
}
