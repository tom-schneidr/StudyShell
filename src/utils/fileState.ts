import type { FileNode } from "../types.ts";
import { isSameOrDescendantPath } from "./pathUtils.ts";

export function removeFileNodesWithinPath(nodes: FileNode[], deletedPath: string): FileNode[] {
  return nodes.filter((node) => !isSameOrDescendantPath(node.path, deletedPath));
}

export function collectFilePaths(nodes: FileNode[]): Set<string> {
  const paths = new Set<string>();

  const visit = (entries: FileNode[]) => {
    for (const entry of entries) {
      if (entry.is_dir) {
        visit(entry.children ?? []);
        continue;
      }

      paths.add(entry.path);
    }
  };

  visit(nodes);
  return paths;
}

export function filterFileNodesByPaths(nodes: FileNode[], liveFilePaths: Set<string>): FileNode[] {
  return nodes.filter((node) => liveFilePaths.has(node.path));
}

export function filterRecordByPaths<T>(
  record: Record<string, T>,
  liveFilePaths: Set<string>,
): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([path]) => liveFilePaths.has(path)));
}
