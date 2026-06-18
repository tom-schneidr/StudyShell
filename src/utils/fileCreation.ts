import type { FileNode } from "../types.ts";
import { getParentPath, joinPath } from "./pathUtils.ts";

const INVALID_WINDOWS_CHARS = /[<>:"/\\|?*\u0000-\u001F]/g;

export function resolveCreationDirectory(node: Pick<FileNode, "is_dir" | "path">): string {
  if (node.is_dir) {
    return node.path;
  }

  return getParentPath(node.path);
}

export function normalizeMarkdownFileName(rawName: string): string {
  const trimmed = rawName.trim();
  const fallback = "untitled-note";
  const baseName = trimmed.length > 0 ? trimmed : fallback;
  const sanitized = sanitizeEntryName(baseName);
  const finalName = sanitized.length > 0 ? sanitized : fallback;

  return finalName.toLowerCase().endsWith(".md") ? finalName : `${finalName}.md`;
}

export function normalizeDirectoryName(rawName: string): string {
  const trimmed = rawName.trim();
  const fallback = "untitled-folder";
  const baseName = trimmed.length > 0 ? trimmed : fallback;
  const sanitized = sanitizeEntryName(baseName);
  return sanitized.length > 0 ? sanitized : fallback;
}

export function sanitizeEntryName(rawName: string): string {
  return rawName
    .replace(INVALID_WINDOWS_CHARS, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");
}

export function normalizeRenameName(
  node: Pick<FileNode, "is_dir" | "name" | "extension">,
  rawName: string,
): string {
  if (node.is_dir) {
    return normalizeDirectoryName(rawName);
  }

  const fallbackBaseName = sanitizeEntryName(node.name.replace(/\.[^.]+$/, "")) || "untitled-file";
  const sanitized = sanitizeEntryName(rawName);
  const hasExplicitExtension = /\.[^.]+$/.test(sanitized);
  const normalizedBaseName = sanitized.length > 0 ? sanitized : fallbackBaseName;

  if (hasExplicitExtension || !node.extension) {
    return normalizedBaseName;
  }

  return `${normalizedBaseName}.${node.extension}`;
}

export function listChildNamesForDirectory(
  nodes: FileNode[],
  directoryPath: string,
  rootPath?: string | null,
): string[] {
  if (rootPath && directoryPath === rootPath) {
    return nodes.map((node) => node.name);
  }

  for (const node of nodes) {
    if (!node.is_dir) {
      continue;
    }

    if (node.path === directoryPath) {
      return (node.children ?? []).map((child) => child.name);
    }

    const nested = listChildNamesForDirectory(node.children ?? [], directoryPath);
    if (nested.length > 0) {
      return nested;
    }
  }

  return [];
}

export function suggestUniqueMarkdownFileName(existingNames: string[], rawName: string): string {
  const normalized = normalizeMarkdownFileName(rawName);
  const existing = new Set(existingNames.map((name) => name.toLowerCase()));

  if (!existing.has(normalized.toLowerCase())) {
    return normalized;
  }

  const baseName = normalized.replace(/\.md$/i, "");
  let index = 2;

  while (existing.has(`${baseName}-${index}.md`.toLowerCase())) {
    index += 1;
  }

  return `${baseName}-${index}.md`;
}

export function suggestUniqueDirectoryName(existingNames: string[], rawName: string): string {
  const normalized = normalizeDirectoryName(rawName);
  const existing = new Set(existingNames.map((name) => name.toLowerCase()));

  if (!existing.has(normalized.toLowerCase())) {
    return normalized;
  }

  let index = 2;
  while (existing.has(`${normalized}-${index}`.toLowerCase())) {
    index += 1;
  }

  return `${normalized}-${index}`;
}

export function buildMarkdownNotePath(
  node: Pick<FileNode, "is_dir" | "path">,
  rawName: string,
): string {
  const directory = resolveCreationDirectory(node);
  const fileName = normalizeMarkdownFileName(rawName);
  return joinPath(directory, fileName);
}

export function buildNewMarkdownContent(fileName: string): string {
  const title = fileName.replace(/\.md$/i, "").replace(/[-_]+/g, " ").trim() || "Untitled Note";
  const heading = title.replace(/\b\w/g, (char) => char.toUpperCase());
  return `# ${heading}\n\n`;
}

export function buildDirectoryPath(
  node: Pick<FileNode, "is_dir" | "path">,
  rawName: string,
): string {
  const directory = resolveCreationDirectory(node);
  const folderName = normalizeDirectoryName(rawName);
  return joinPath(directory, folderName);
}
