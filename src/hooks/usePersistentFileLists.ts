import { useCallback, useState } from "react";
import type { FileNode } from "../types";
import { STORAGE_KEYS } from "../utils/appPreferences";
import { deserializeRecentFiles, serializeRecentFiles } from "../utils/recentFiles";

function readJsonFileNodes(storage: Storage, key: string): FileNode[] {
  try {
    const stored = storage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function usePersistentFileLists(storage: Storage = window.localStorage) {
  const [recentFiles, setRecentFiles] = useState<FileNode[]>(() => {
    try {
      const stored = storage.getItem(STORAGE_KEYS.recentFiles) ?? storage.getItem("recentFiles");
      return stored ? deserializeRecentFiles(stored) : [];
    } catch {
      return [];
    }
  });
  const [pinnedFiles, setPinnedFiles] = useState<FileNode[]>(() =>
    readJsonFileNodes(storage, STORAGE_KEYS.pinnedFiles).length > 0
      ? readJsonFileNodes(storage, STORAGE_KEYS.pinnedFiles)
      : readJsonFileNodes(storage, "pinnedFiles"),
  );
  const [openTabs, setOpenTabs] = useState<FileNode[]>(() =>
    readJsonFileNodes(storage, STORAGE_KEYS.openTabs).length > 0
      ? readJsonFileNodes(storage, STORAGE_KEYS.openTabs)
      : readJsonFileNodes(storage, "openTabs"),
  );

  const persistRecentFiles = useCallback(
    (files: FileNode[]) => {
      storage.setItem(STORAGE_KEYS.recentFiles, serializeRecentFiles(files));
    },
    [storage],
  );

  const persistPinnedFiles = useCallback(
    (files: FileNode[]) => {
      storage.setItem(STORAGE_KEYS.pinnedFiles, JSON.stringify(files));
    },
    [storage],
  );

  const persistOpenTabs = useCallback(
    (files: FileNode[]) => {
      storage.setItem(STORAGE_KEYS.openTabs, JSON.stringify(files));
    },
    [storage],
  );

  const persistLastActiveFilePath = useCallback(
    (path: string) => {
      storage.setItem(STORAGE_KEYS.lastActiveFilePath, path);
    },
    [storage],
  );

  const readLastActiveFilePath = useCallback(
    () => storage.getItem(STORAGE_KEYS.lastActiveFilePath) ?? storage.getItem("lastActiveFilePath"),
    [storage],
  );

  return {
    recentFiles,
    setRecentFiles,
    pinnedFiles,
    setPinnedFiles,
    openTabs,
    setOpenTabs,
    persistRecentFiles,
    persistPinnedFiles,
    persistOpenTabs,
    persistLastActiveFilePath,
    readLastActiveFilePath,
  };
}
