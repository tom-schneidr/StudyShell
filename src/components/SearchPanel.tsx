import { useState, useEffect, useCallback } from "react";
import { Search, FileText, Loader2, Hash } from "lucide-react";
import type { FileNode } from "../types";

interface SearchResult {
  path: string;
  line_number: number;
  content: string;
}

interface SearchPanelProps {
  onSearch: (query: string) => Promise<SearchResult[]>;
  onFileSelect: (node: FileNode) => void;
  rootPath: string | null;
}

export default function SearchPanel({ onSearch, onFileSelect, rootPath }: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const performSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await onSearch(q);
      setResults(res);
    } catch (e) {
      console.error("Search failed:", e);
    } finally {
      setLoading(false);
    }
  }, [onSearch]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query);
    }, 400);
    return () => clearTimeout(timer);
  }, [query, performSearch]);

  const handleResultClick = (result: SearchResult) => {
    const fileName = result.path.split(/[/\\]/).pop() || "";
    onFileSelect({
      name: fileName,
      path: result.path,
      is_dir: false,
      extension: fileName.includes(".") ? fileName.split(".").pop() || null : null,
      children: null,
    });
  };

  // Group results by file
  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.path]) acc[result.path] = [];
    acc[result.path].push(result);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  return (
    <div className="flex flex-col h-full bg-shell-bg/50">
      <div className="p-4 border-b border-shell-border">
        <div className="relative group">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-shell-text-muted group-focus-within:text-shell-accent transition-colors" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search in all files..."
            className="w-full bg-shell-surface/50 border border-shell-border pl-10 pr-4 py-2.5 rounded-xl text-sm text-shell-text placeholder:text-shell-text-muted outline-none focus:border-shell-accent/40 focus:bg-shell-surface transition-all"
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 size={14} className="animate-spin text-shell-accent" />
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {results.length > 0 ? (
          <div className="py-2">
            {Object.entries(groupedResults).map(([path, fileResults]) => {
              const fileName = path.split(/[/\\]/).pop() || "";
              const relativePath = rootPath ? path.replace(rootPath, "").replace(/^[/\\]/, "") : path;

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
                    {fileResults.map((res, i) => (
                      <button
                        key={`${path}-${i}`}
                        onClick={() => handleResultClick(res)}
                        className="w-full text-left px-5 py-2.5 hover:bg-shell-accent/5 transition-colors flex items-start gap-3 group border-l-2 border-transparent hover:border-shell-accent/30"
                      >
                        <div className="flex items-center gap-1 text-[10px] font-mono text-shell-text-muted bg-shell-surface px-1 rounded border border-shell-border mt-0.5 group-hover:bg-shell-accent/10 group-hover:text-shell-accent transition-colors">
                          <Hash size={10} />
                          <span>{res.line_number}</span>
                        </div>
                        <p className="text-[12px] text-shell-text-secondary line-clamp-2 leading-relaxed break-all">
                           {res.content}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : query.length >= 2 && !loading ? (
          <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
            <div className="w-12 h-12 rounded-full bg-shell-surface flex items-center justify-center mb-4 text-shell-text-muted opacity-30">
               <Search size={24} />
            </div>
            <p className="text-sm text-shell-text-muted">No results found for "{query}"</p>
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
