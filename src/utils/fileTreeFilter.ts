import type { FileNode } from "../types.ts";
import fuzzysort from "fuzzysort";

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

function matchesNode(node: FileNode, normalizedQuery: string): boolean {
  if (!normalizedQuery) {
    return true;
  }

  return fuzzysort.single(normalizedQuery, node.name) !== null;
}

export function filterFileTree(nodes: FileNode[], query: string): FileNode[] {
  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery) {
    return nodes;
  }

  const filteredNodes: FileNode[] = [];

  for (const node of nodes) {
    if (node.is_dir) {
      if (matchesNode(node, normalizedQuery)) {
        filteredNodes.push(node);
        continue;
      }

      const filteredChildren = filterFileTree(node.children ?? [], normalizedQuery);
      if (filteredChildren.length > 0) {
        filteredNodes.push({
          ...node,
          children: filteredChildren,
        });
      }
      continue;
    }

    if (matchesNode(node, normalizedQuery)) {
      filteredNodes.push(node);
    }
  }

  return filteredNodes;
}
