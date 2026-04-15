export interface SearchResultLike {
  path: string;
  line_number: number;
  content: string;
}

export function shouldExecuteSearch(query: string, rootPath: string | null): boolean {
  return Boolean(rootPath && query.trim().length >= 2);
}

export function formatSearchError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return `Search failed: ${error.message.trim()}`;
  }

  if (typeof error === "string" && error.trim()) {
    return `Search failed: ${error.trim()}`;
  }

  return "Search failed. Please try again.";
}

export function getDefaultSearchResultIndex(resultCount: number): number {
  return resultCount > 0 ? 0 : -1;
}

export function getNextSearchResultIndex(
  resultCount: number,
  currentIndex: number,
  direction: 1 | -1,
): number {
  if (resultCount === 0) {
    return -1;
  }

  if (currentIndex < 0) {
    return direction === 1 ? 0 : resultCount - 1;
  }

  return (currentIndex + direction + resultCount) % resultCount;
}

export function getSearchResultsSummary(resultCount: number, fileCount: number): string {
  if (resultCount === 0) {
    return "No matches";
  }

  const matchLabel = resultCount === 1 ? "match" : "matches";
  const fileLabel = fileCount === 1 ? "file" : "files";
  return `${resultCount} ${matchLabel} in ${fileCount} ${fileLabel}`;
}

export function groupSearchResultsByFile<T extends SearchResultLike>(
  results: T[],
): Array<{ path: string; results: T[] }> {
  const grouped = new Map<string, T[]>();

  for (const result of results) {
    const existing = grouped.get(result.path);
    if (existing) {
      existing.push(result);
    } else {
      grouped.set(result.path, [result]);
    }
  }

  return Array.from(grouped.entries())
    .sort(([pathA], [pathB]) => pathA.localeCompare(pathB))
    .map(([path, fileResults]) => ({
      path,
      results: [...fileResults].sort((a, b) => a.line_number - b.line_number),
    }));
}
