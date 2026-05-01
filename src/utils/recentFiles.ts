import type { FileNode } from "../types.ts";
import { isSameOrDescendantPath } from "./pathUtils.ts";

export const RECENT_FILES_LIMIT = 5;

function isValidFileNode(value: unknown): value is FileNode {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const extension = candidate.extension;
  const children = candidate.children;

  const hasValidExtension = extension === null || typeof extension === "string";
  const hasValidChildren = children === null || Array.isArray(children);

  return (
    typeof candidate.name === "string" &&
    typeof candidate.path === "string" &&
    typeof candidate.is_dir === "boolean" &&
    hasValidExtension &&
    hasValidChildren
  );
}

export function normalizeRecentFiles(files: FileNode[]): FileNode[] {
  const seenPaths = new Set<string>();
  const normalized: FileNode[] = [];

  for (const file of files) {
    if (seenPaths.has(file.path)) {
      continue;
    }

    seenPaths.add(file.path);
    normalized.push(file);

    if (normalized.length === RECENT_FILES_LIMIT) {
      break;
    }
  }

  return normalized;
}

export function deserializeRecentFiles(raw: string): FileNode[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return normalizeRecentFiles(parsed.filter(isValidFileNode));
  } catch {
    return [];
  }
}

export function serializeRecentFiles(files: FileNode[]): string {
  return JSON.stringify(normalizeRecentFiles(files));
}

export function filterRecentFilesForWorkspace(
  files: FileNode[],
  rootPath: string | null,
  liveFilePaths: Set<string>,
): FileNode[] {
  if (!rootPath) {
    return [];
  }

  return normalizeRecentFiles(
    files.filter(
      (file) =>
        !file.is_dir &&
        isSameOrDescendantPath(file.path, rootPath) &&
        liveFilePaths.has(file.path),
    ),
  );
}
