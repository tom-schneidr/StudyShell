import {
  ChevronLeft,
  FilePlus2,
  FolderPlus,
  FolderSearch,
  Loader2,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import FileTree from "./FileTree";
import SearchPanel from "./SearchPanel";
import type { DirectoryStats, FileNode, SearchResult } from "../types";
import { formatBytes } from "../types";
import { formatFilesystemError } from "../utils/filesystemErrors";
import { filterFileTree } from "../utils/fileTreeFilter";
import { FileTypeIcon } from "../utils/fileIcons";
import { getPathBaseName } from "../utils/pathUtils";
import {
  DEFAULT_SIDEBAR_TAB,
  formatSearchTabBadge,
  parseSidebarTab,
  type SidebarTab,
} from "../utils/sidebarState";

interface SidebarProps {
  rootPath: string | null;
  fileTree: FileNode[];
  directoryStats: DirectoryStats | null;
  loading: boolean;
  statsLoading: boolean;
  error: string | null;
  activeFilePath: string | null;
  selectedSourcePaths: string[];
  recentFiles: FileNode[];
  pinnedFiles: FileNode[];
  onTogglePin: (node: FileNode) => void;
  onClearRecentFiles: () => void;
  onSelectRoot: () => void;
  onRefresh: () => void;
  onFileSelect: (node: FileNode) => void;
  onContextMenu: (e: React.MouseEvent, node: FileNode) => void;
  onToggleSource: (node: FileNode) => void;
  onCreateRootNote: () => void;
  onCreateRootFolder: () => void;
  onCollapse: () => void;
  onSearch: (query: string) => Promise<SearchResult[]>;
}

function QuickFileRow({
  file,
  isActive,
  onSelect,
}: {
  file: FileNode;
  isActive: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-[12px] transition-colors cursor-pointer ${
        isActive
          ? "bg-shell-accent/10 text-shell-accent"
          : "text-shell-text-secondary hover:bg-shell-surface-hover hover:text-shell-text"
      }`}
    >
      <FileTypeIcon extension={file.extension} name={file.name} size={13} active={isActive} />
      <span className="truncate">{file.name}</span>
    </button>
  );
}

export default function Sidebar({
  rootPath,
  fileTree,
  directoryStats,
  loading,
  statsLoading,
  error,
  activeFilePath,
  selectedSourcePaths,
  recentFiles,
  pinnedFiles,
  onClearRecentFiles,
  onSelectRoot,
  onRefresh,
  onFileSelect,
  onContextMenu,
  onToggleSource,
  onCreateRootNote,
  onCreateRootFolder,
  onCollapse,
  onSearch,
}: SidebarProps) {
  const [activeTab, setActiveTab] = useState<SidebarTab>(() => {
    try {
      return parseSidebarTab(localStorage.getItem("sidebarActiveTab"));
    } catch {
      return DEFAULT_SIDEBAR_TAB;
    }
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResultCount, setSearchResultCount] = useState(0);
  const filterInputRef = useRef<HTMLInputElement>(null);
  const rootName = rootPath ? getPathBaseName(rootPath) : null;
  const filteredTree = useMemo(
    () => filterFileTree(fileTree, searchQuery),
    [fileTree, searchQuery],
  );
  const hasActiveSearch = searchQuery.trim().length > 0;
  const formattedError = formatFilesystemError(error);
  const searchBadge = formatSearchTabBadge(searchResultCount);

  const quickAccessFiles = useMemo(() => {
    const seen = new Set<string>();
    const items: FileNode[] = [];
    for (const file of [...pinnedFiles, ...recentFiles]) {
      if (seen.has(file.path)) continue;
      seen.add(file.path);
      items.push(file);
      if (items.length >= 8) break;
    }
    return items;
  }, [pinnedFiles, recentFiles]);

  useEffect(() => {
    try {
      localStorage.setItem("sidebarActiveTab", activeTab);
    } catch {}
  }, [activeTab]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        activeTab === "explorer" &&
        hasActiveSearch &&
        document.activeElement === filterInputRef.current
      ) {
        setSearchQuery("");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTab, hasActiveSearch]);

  const statsLine =
    rootPath && directoryStats
      ? `${directoryStats.file_count} files · ${formatBytes(directoryStats.total_size)}`
      : statsLoading
        ? "Loading…"
        : null;

  return (
    <div className="h-full flex flex-col bg-shell-surface overflow-hidden">
      <div className="flex-shrink-0 px-3 py-2.5 border-b border-shell-border">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onSelectRoot}
            className="flex-1 min-w-0 text-left text-[13px] font-medium text-shell-text truncate hover:text-shell-accent transition-colors cursor-pointer"
            title={rootPath ?? "Select workspace folder"}
          >
            {rootName ?? "Open folder…"}
          </button>
          {rootPath && (
            <>
              <IconBtn title="New folder" onClick={onCreateRootFolder}>
                <FolderPlus size={14} />
              </IconBtn>
              <IconBtn title="New note" onClick={onCreateRootNote}>
                <FilePlus2 size={14} />
              </IconBtn>
              <IconBtn title="Refresh" onClick={onRefresh}>
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              </IconBtn>
            </>
          )}
          <IconBtn title="Hide sidebar" onClick={onCollapse}>
            <ChevronLeft size={14} />
          </IconBtn>
        </div>

        <div className="mt-2 flex border-b border-shell-border">
          <TabButton active={activeTab === "explorer"} onClick={() => setActiveTab("explorer")}>
            Files
          </TabButton>
          <TabButton active={activeTab === "search"} onClick={() => setActiveTab("search")}>
            Search
            {searchBadge ? <span className="text-[10px] text-shell-text-muted">{searchBadge}</span> : null}
          </TabButton>
        </div>
      </div>

      <div className={activeTab === "explorer" ? "flex min-h-0 flex-1 flex-col" : "hidden"}>
        {rootPath && (
          <div className="flex-shrink-0 px-3 py-2 border-b border-shell-border-subtle space-y-2">
            {statsLine && (
              <p className="text-[11px] text-shell-text-muted truncate" title={rootPath}>
                {statsLine}
              </p>
            )}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-shell-text-muted" />
              <input
                ref={filterInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter files…"
                className="w-full rounded-md border border-shell-border bg-shell-bg pl-8 pr-8 py-1.5 text-[12px] text-shell-text placeholder:text-shell-text-muted outline-none focus:border-shell-accent/50"
              />
              {hasActiveSearch && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-shell-text-muted hover:text-shell-text cursor-pointer"
                  title="Clear filter"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            {formattedError && (
              <p className="text-[11px] text-shell-error leading-relaxed">{formattedError}</p>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {loading && !fileTree.length ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={18} className="animate-spin text-shell-text-muted" />
            </div>
          ) : rootPath ? (
            filteredTree.length > 0 ? (
              <>
                {!hasActiveSearch && quickAccessFiles.length > 0 && (
                  <div className="px-2 py-2 border-b border-shell-border-subtle">
                    <div className="flex items-center justify-between px-1 mb-1">
                      <span className="text-[11px] text-shell-text-muted">Recent</span>
                      {recentFiles.length > 0 && (
                        <button
                          type="button"
                          onClick={onClearRecentFiles}
                          className="text-[11px] text-shell-text-muted hover:text-shell-text cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      {quickAccessFiles.map((file) => (
                        <QuickFileRow
                          key={file.path}
                          file={file}
                          isActive={activeFilePath === file.path}
                          onSelect={() => onFileSelect(file)}
                        />
                      ))}
                    </div>
                  </div>
                )}
                <FileTree
                  nodes={filteredTree}
                  activeFilePath={activeFilePath}
                  selectedSourcePaths={selectedSourcePaths}
                  onFileSelect={onFileSelect}
                  onContextMenu={onContextMenu}
                  onToggleSource={onToggleSource}
                  forceExpandAll={hasActiveSearch}
                />
              </>
            ) : (
              <p className="px-4 py-8 text-center text-[12px] text-shell-text-muted">
                No matches for &ldquo;{searchQuery.trim()}&rdquo;
              </p>
            )
          ) : (
            <div className="px-4 py-12 text-center">
              <FolderSearch size={28} className="mx-auto mb-3 text-shell-text-muted" />
              <p className="text-[13px] text-shell-text-secondary mb-4">
                Choose a folder to browse your study materials.
              </p>
              <button
                type="button"
                onClick={onSelectRoot}
                className="rounded-md bg-shell-accent px-3 py-1.5 text-[12px] font-medium text-white hover:bg-shell-accent-hover cursor-pointer"
              >
                Open folder
              </button>
            </div>
          )}
        </div>
      </div>

      <div className={activeTab === "search" ? "flex-1 overflow-hidden" : "hidden"}>
        <SearchPanel
          onSearch={onSearch}
          onFileSelect={onFileSelect}
          rootPath={rootPath}
          isActive={activeTab === "search"}
          onResultsChange={setSearchResultCount}
        />
      </div>
    </div>
  );
}

function IconBtn({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="p-1.5 rounded-md text-shell-text-muted hover:text-shell-text hover:bg-shell-surface-hover transition-colors cursor-pointer"
    >
      {children}
    </button>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 pb-2 text-[12px] font-medium border-b-2 transition-colors cursor-pointer ${
        active
          ? "border-shell-accent text-shell-text"
          : "border-transparent text-shell-text-muted hover:text-shell-text"
      }`}
    >
      {children}
    </button>
  );
}
