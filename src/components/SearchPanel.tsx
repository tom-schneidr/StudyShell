import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Search, FileText, Loader2, Hash, AlertCircle, X } from "lucide-react";
import type { FileNode, SearchResult } from "../types";
import { getPathBaseName, getPathExtension, getRelativePathFromRoot } from "../utils/pathUtils";
import {
  formatSearchError,
  getDefaultSearchResultIndex,
  getNextSearchResultIndex,
  getSearchResultsSummary,
  groupSearchResultsByFile,
  normalizeSearchQuery,
  shouldExecuteSearch,
} from "../utils/searchResults";

interface SearchPanelProps {
  onSearch: (query: string) => Promise<SearchResult[]>;
  onFileSelect: (node: FileNode) => void;
  rootPath: string | null;
  isActive: boolean;
  onResultsChange?: (matchCount: number) => void;
}

export default function SearchPanel({
  onSearch,
  onFileSelect,
  rootPath,
  isActive,
  onResultsChange,
}: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedResultIndex, setSelectedResultIndex] = useState(-1);
  const latestSearchRequestRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsListRef = useRef<HTMLDivElement>(null);

  const performSearch = useCallback(async (q: string) => {
    const normalizedQuery = normalizeSearchQuery(q);
    if (!shouldExecuteSearch(normalizedQuery, rootPath)) {
      latestSearchRequestRef.current += 1;
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    const requestId = latestSearchRequestRef.current + 1;
    latestSearchRequestRef.current = requestId;
    setLoading(true);
    setError(null);

    try {
      const nextResults = await onSearch(normalizedQuery);
      if (latestSearchRequestRef.current !== requestId) {
        return;
      }
      setResults(nextResults);
    } catch (nextError) {
      if (latestSearchRequestRef.current !== requestId) {
        return;
      }
      setResults([]);
      setError(formatSearchError(nextError));
    } finally {
      if (latestSearchRequestRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [onSearch, rootPath]);

  useEffect(() => {
    if (!shouldExecuteSearch(query, rootPath)) {
      latestSearchRequestRef.current += 1;
      setResults([]);
      setLoading(false);
      setError(null);
    }
  }, [query, rootPath]);

  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query);
    }, 400);

    return () => clearTimeout(timer);
  }, [query, performSearch]);

  const handleResultClick = useCallback((result: SearchResult) => {
    const fileName = getPathBaseName(result.path);
    onFileSelect({
      name: fileName,
      path: result.path,
      is_dir: false,
      extension: getPathExtension(result.path),
      children: null,
    });
  }, [onFileSelect]);

  const groupedResults = useMemo(() => groupSearchResultsByFile(results), [results]);
  const flattenedResults = useMemo(
    () => groupedResults.flatMap((group) => group.results),
    [groupedResults],
  );
  const normalizedQuery = useMemo(() => normalizeSearchQuery(query), [query]);
  const hasActiveQuery = normalizedQuery.length > 0;
  const searchSummary = getSearchResultsSummary(results.length, groupedResults.length);

  useEffect(() => {
    if (isActive) {
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isActive]);

  useEffect(() => {
    setSelectedResultIndex(getDefaultSearchResultIndex(flattenedResults.length));
  }, [flattenedResults]);

  useEffect(() => {
    onResultsChange?.(hasActiveQuery && !loading && !error ? results.length : 0);
  }, [error, hasActiveQuery, loading, onResultsChange, results.length]);

  useEffect(() => {
    if (selectedResultIndex < 0) {
      return;
    }

    const selectedElement = resultsListRef.current?.querySelector<HTMLElement>(
      `[data-result-index="${selectedResultIndex}"]`,
    );
    selectedElement?.scrollIntoView({ block: "nearest" });
  }, [selectedResultIndex]);

  return (
    <div className="flex flex-col h-full bg-shell-bg/50">
      <div className="p-4 border-b border-shell-border">
        <div className="relative group">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-shell-text-muted group-focus-within:text-shell-accent transition-colors" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && hasActiveQuery) {
                e.preventDefault();
                setQuery("");
                return;
              }

              if (e.key === "ArrowDown") {
                if (flattenedResults.length === 0) {
                  return;
                }
                e.preventDefault();
                setSelectedResultIndex((prev) => getNextSearchResultIndex(flattenedResults.length, prev, 1));
                return;
              }

              if (e.key === "ArrowUp") {
                if (flattenedResults.length === 0) {
                  return;
                }
                e.preventDefault();
                setSelectedResultIndex((prev) => getNextSearchResultIndex(flattenedResults.length, prev, -1));
                return;
              }

              if (e.key === "Enter" && selectedResultIndex >= 0 && flattenedResults[selectedResultIndex]) {
                e.preventDefault();
                handleResultClick(flattenedResults[selectedResultIndex]);
              }
            }}
            placeholder="Search in all files..."
            className="w-full bg-shell-surface/50 border border-shell-border pl-10 pr-10 py-2.5 rounded-xl text-sm text-shell-text placeholder:text-shell-text-muted outline-none focus:border-shell-accent/40 focus:bg-shell-surface transition-all"
          />
          {!loading && hasActiveQuery && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-shell-text-muted hover:text-shell-text hover:bg-shell-surface transition-colors cursor-pointer"
              title="Clear search"
            >
              <X size={12} />
            </button>
          )}
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 size={14} className="animate-spin text-shell-accent" />
            </div>
          )}
        </div>
        {hasActiveQuery && !error && (
          <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-shell-text-muted">
            {loading ? "Searching..." : searchSummary}
          </p>
        )}
        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-shell-error/20 bg-shell-error/10 px-3 py-2 text-[11px] leading-relaxed text-shell-error">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <div ref={resultsListRef} className="flex-1 overflow-y-auto custom-scrollbar">
        {results.length > 0 ? (
          <div className="py-2">
            {(() => {
              let globalResultIndex = 0;

              return groupedResults.map(({ path, results: fileResults }) => {
                const fileName = getPathBaseName(path);
                const relativePath = rootPath ? getRelativePathFromRoot(path, rootPath) : path;

                return (
                  <div key={path} className="mb-4">
                    <div className="px-4 py-2 flex items-center gap-2 text-shell-text-secondary">
                      <FileText size={14} className="text-shell-accent/70" />
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold truncate leading-none mb-1">{fileName}</div>
                        <div className="text-[10px] text-shell-text-muted truncate opacity-60 font-medium uppercase tracking-tight">{relativePath}</div>
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      {fileResults.map((result, indexWithinFile) => {
                        const resultIndex = globalResultIndex;
                        globalResultIndex += 1;
                        const isSelected = resultIndex === selectedResultIndex;

                        return (
                          <button
                            key={`${path}-${indexWithinFile}`}
                            data-result-index={resultIndex}
                            onClick={() => handleResultClick(result)}
                            onMouseEnter={() => setSelectedResultIndex(resultIndex)}
                            className={`w-full text-left px-5 py-2.5 transition-colors flex items-start gap-3 group border-l-2 ${
                              isSelected
                                ? "bg-shell-accent/10 border-shell-accent/40"
                                : "border-transparent hover:bg-shell-accent/5 hover:border-shell-accent/30"
                            }`}
                          >
                            <div className={`flex items-center gap-1 text-[10px] font-mono px-1 rounded border mt-0.5 transition-colors ${
                              isSelected
                                ? "text-shell-accent bg-shell-accent/10 border-shell-accent/20"
                                : "text-shell-text-muted bg-shell-surface border-shell-border group-hover:bg-shell-accent/10 group-hover:text-shell-accent"
                            }`}>
                              <Hash size={10} />
                              <span>{result.line_number}</span>
                            </div>
                            <p className={`text-[12px] line-clamp-2 leading-relaxed break-all ${
                              isSelected ? "text-shell-text" : "text-shell-text-secondary"
                            }`}>
                              {result.content}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        ) : normalizedQuery.length >= 2 && !loading ? (
          <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
            <div className="w-12 h-12 rounded-full bg-shell-surface flex items-center justify-center mb-4 text-shell-text-muted opacity-30">
              <Search size={24} />
            </div>
            <p className="text-sm text-shell-text-muted">No results found for "{normalizedQuery}"</p>
          </div>
        ) : !loading && (
          <div className="flex flex-col items-center justify-center py-20 px-8 text-center opacity-40">
            <Search size={32} className="text-shell-text-muted mb-4 stroke-[1.5]" />
            <p className="text-xs text-shell-text-muted font-medium uppercase tracking-[0.2em]">Enter a search term</p>
          </div>
        )}
      </div>
    </div>
  );
}
