import type { FileNode } from "../types.ts";

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

function matchesNode(node: FileNode, normalizedQuery: string): boolean {
  if (!normalizedQuery) {
    return true;
  }

  return node.name.toLowerCase().includes(normalizedQuery);
}

export function filterFileTree(nodes: FileNode[], query: string): FileNode[] {
  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery) {
    return nodes;
  }

  const filteredNodes: FileNode[] = [];

  for (const node of nodes) {
    if (node.is_dir) {
      const filteredChildren = filterFileTree(node.children ?? [], normalizedQuery);
      if (matchesNode(node, normalizedQuery) || filteredChildren.length > 0) {
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
