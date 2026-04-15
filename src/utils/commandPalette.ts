import type { FileNode } from "../types.ts";
import type { CommandItem } from "../components/CommandPalette";

export function buildWorkspaceCommandTarget(
  activeFile: FileNode | null,
  rootPath: string | null,
  fileTree: FileNode[],
): FileNode | null {
  if (activeFile) {
    return activeFile;
  }

  if (!rootPath) {
    return null;
  }

  return {
    name: rootPath.split(/[/\\]/).pop() || rootPath,
    path: rootPath,
    is_dir: true,
    extension: null,
    children: fileTree,
  };
}

export function hasCommandPaletteMatches(matchCount: number): boolean {
  return matchCount > 0;
}

export function commandMatchesQuery(command: Pick<CommandItem, "label" | "category" | "description">, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  return (
    command.label.toLowerCase().includes(normalizedQuery) ||
    command.category.toLowerCase().includes(normalizedQuery) ||
    (command.description?.toLowerCase().includes(normalizedQuery) ?? false)
  );
}

export function getDefaultCommandIndex(commands: Pick<CommandItem, "disabled">[]): number {
  if (commands.length === 0) {
    return -1;
  }

  const firstEnabledIndex = commands.findIndex((command) => !command.disabled);
  return firstEnabledIndex >= 0 ? firstEnabledIndex : 0;
}

export function getNextEnabledCommandIndex(
  commands: Pick<CommandItem, "disabled">[],
  currentIndex: number,
  direction: 1 | -1,
): number {
  if (commands.length === 0) {
    return -1;
  }

  for (let offset = 1; offset <= commands.length; offset += 1) {
    const candidateIndex = (currentIndex + direction * offset + commands.length) % commands.length;
    if (!commands[candidateIndex].disabled) {
      return candidateIndex;
    }
  }

  return getDefaultCommandIndex(commands);
}
