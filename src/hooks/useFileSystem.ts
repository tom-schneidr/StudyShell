import { useState, useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import type { FileNode, FsChangeEvent } from "../types";

export function useFileSystem() {
  const [rootPath, setRootPath] = useState<string | null>(null);
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unlistenRef = useRef<(() => void) | null>(null);

  // Select a root folder using the native dialog
  const selectRootFolder = useCallback(async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select your study root folder",
      });

      if (selected && typeof selected === "string") {
        setRootPath(selected);
        await refreshTree(selected);
        // Start watching the directory
        await invoke("start_watching", { path: selected });
      }
    } catch (e) {
      setError(`Failed to select folder: ${e}`);
    }
  }, []);

  // Refresh the file tree from a given root
  const refreshTree = useCallback(async (path?: string) => {
    const targetPath = path || rootPath;
    if (!targetPath) return;

    setLoading(true);
    setError(null);
    try {
      const tree = await invoke<FileNode[]>("list_directory", {
        path: targetPath,
      });
      setFileTree(tree);
    } catch (e) {
      setError(`Failed to load directory: ${e}`);
    } finally {
      setLoading(false);
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

  // Listen for filesystem changes
  useEffect(() => {
    let mounted = true;

    const setupListener = async () => {
      const unlisten = await listen<FsChangeEvent>("fs-changed", () => {
        if (mounted && rootPath) {
          // Debounce refresh slightly to batch rapid changes
          setTimeout(() => {
            if (mounted) refreshTree();
          }, 300);
        }
      });
      unlistenRef.current = unlisten;
    };

    setupListener();

    return () => {
      mounted = false;
      if (unlistenRef.current) {
        unlistenRef.current();
      }
    };
  }, [rootPath, refreshTree]);

  return {
    rootPath,
    fileTree,
    loading,
    error,
    selectRootFolder,
    refreshTree,
    readFile,
    readFileBinary,
    writeFile,
    writeFileBinary,
    createFile,
  };
}
