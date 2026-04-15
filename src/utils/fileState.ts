import type { FileNode } from "../types.ts";
import { isSameOrDescendantPath } from "./pathUtils.ts";

export function removeFileNodesWithinPath(nodes: FileNode[], deletedPath: string): FileNode[] {
  return nodes.filter((node) => !isSameOrDescendantPath(node.path, deletedPath));
}
