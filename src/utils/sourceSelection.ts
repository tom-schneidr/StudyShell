import type { FileNode } from "../types.ts";
import { canUseFileAsChatContext } from "./chatContext.ts";

export function canSelectSource(node: Pick<FileNode, "is_dir" | "extension">): boolean {
  return !node.is_dir && canUseFileAsChatContext(node);
}

export function normalizeSelectedSources<T extends Pick<FileNode, "path" | "is_dir" | "extension">>(
  sources: T[],
): T[] {
  const seenPaths = new Set<string>();

  return sources.filter((source) => {
    if (!canSelectSource(source) || seenPaths.has(source.path)) {
      return false;
    }

    seenPaths.add(source.path);
    return true;
  });
}

export function canClearSelectedSources(selectedCount: number): boolean {
  return selectedCount > 0;
}

export function getSelectedSourcesSummary(selectedCount: number): string {
  return selectedCount === 1 ? "1 source attached" : `${selectedCount} sources attached`;
}
