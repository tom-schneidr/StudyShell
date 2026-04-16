import { motion } from "framer-motion";
import {
  FilePlus2,
  FolderSearch,
  FolderPlus,
  RefreshCw,
  Loader2,
  ChevronLeft,
  Search,
  X,
  Clock,
  File
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import FileTree from "./FileTree";
import SearchPanel from "./SearchPanel";
import type { DirectoryStats, FileNode } from "../types";
import { formatBytes } from "../types";
import { formatFilesystemError } from "../utils/filesystemErrors";
import { filterFileTree } from "../utils/fileTreeFilter";
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
  onClearRecentFiles: () => void;
  onSelectRoot: () => void;
  onRefresh: () => void;
  onFileSelect: (node: FileNode) => void;
  onContextMenu: (e: React.MouseEvent, node: FileNode) => void;
  onToggleSource: (node: FileNode) => void;
  onCreateRootNote: () => void;
  onCreateRootFolder: () => void;
  onCollapse: () => void;
  onSearch: (query: string) => Promise<any[]>;
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
  const rootName = rootPath ? getPathBaseName(rootPath) : null;
  const filteredTree = useMemo(
    () => filterFileTree(fileTree, searchQuery),
    [fileTree, searchQuery]
  );
  const hasActiveSearch = searchQuery.trim().length > 0;
  const formattedError = formatFilesystemError(error);
  const searchBadge = formatSearchTabBadge(searchResultCount);

  useEffect(() => {
    try {
      localStorage.setItem("sidebarActiveTab", activeTab);
    } catch {}
  }, [activeTab]);

  return (
    <div className="h-full flex flex-col bg-shell-surface border-r border-shell-border overflow-hidden">
      {/* Header - Modern Academic Spacing */}
      <div className="flex-shrink-0 px-5 pt-8 pb-4 border-b border-shell-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-shell-accent to-purple-500 flex items-center justify-center shadow-lg shadow-shell-accent/20">
              <span className="text-white text-[12px] font-black">S</span>
            </div>
            <h1 className="text-[15px] font-bold text-shell-text tracking-tight uppercase">
              Explorer
            </h1>
          </div>
          <div className="flex items-center gap-1">
            {rootPath && (
                <button
                onClick={onCreateRootFolder}
                className="p-1.5 rounded-md text-shell-text-muted hover:text-shell-text
                    hover:bg-shell-surface-hover transition-colors duration-150 cursor-pointer"
                title="New folder in root"
                >
                <FolderPlus size={14} />
                </button>
            )}
            {rootPath && (
                <button
                onClick={onCreateRootNote}
                className="p-1.5 rounded-md text-shell-text-muted hover:text-shell-text
                    hover:bg-shell-surface-hover transition-colors duration-150 cursor-pointer"
                title="New note in root"
                >
                <FilePlus2 size={14} />
                </button>
            )}
            {rootPath && (
                <button
                onClick={onRefresh}
                className="p-1.5 rounded-md text-shell-text-muted hover:text-shell-text
                    hover:bg-shell-surface-hover transition-colors duration-150 cursor-pointer"
                title="Refresh file tree"
                >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                </button>
            )}
            <button
                onClick={onCollapse}
                className="p-1.5 rounded-md text-shell-text-muted hover:text-shell-text
                hover:bg-shell-surface-hover transition-colors duration-150 cursor-pointer"
                title="Collapse Sidebar"
            >
                <ChevronLeft size={16} />
            </button>
          </div>
        </div>

        <motion.button
          onClick={onSelectRoot}
          className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl
            text-[12.5px] font-semibold transition-all duration-200 cursor-pointer
            ${!rootPath 
              ? "bg-shell-accent text-white shadow-lg shadow-shell-accent/25 border-none animate-pulse-subtle" 
              : "bg-shell-accent/10 text-shell-accent border border-shell-accent/20 hover:bg-shell-accent/20 hover:border-shell-accent/30 shadow-sm"}`}
          whileTap={{ scale: 0.97 }}
        >
          <FolderSearch size={16} />
          {rootPath ? "Change Folder" : "Select Root"}
        </motion.button>
      </div>

      {/* Modern Tab Toggle */}
      <div className="flex-shrink-0 px-4 py-2 border-b border-shell-border-subtle bg-shell-surface-hover/20">
        <div className="flex bg-shell-bg/50 p-1 rounded-xl border border-shell-border">
          <button
            onClick={() => setActiveTab("explorer")}
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${
              activeTab === "explorer"
                ? "bg-shell-surface text-shell-accent shadow-sm"
                : "text-shell-text-muted hover:text-shell-text"
            }`}
          >
            <FolderSearch size={12} />
            Explorer
          </button>
          <button
            onClick={() => setActiveTab("search")}
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${
              activeTab === "search"
                ? "bg-shell-surface text-shell-accent shadow-sm"
                : "text-shell-text-muted hover:text-shell-text"
            }`}
          >
            <Search size={12} />
            Search
            {searchBadge && (
              <span className={`min-w-5 rounded-full px-1.5 py-0.5 text-[9px] font-black tracking-normal ${
                activeTab === "search"
                  ? "bg-shell-accent/15 text-shell-accent"
                  : "bg-shell-surface text-shell-text-muted border border-shell-border"
              }`}>
                {searchBadge}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className={activeTab === "explorer" ? "flex min-h-0 flex-1 flex-col" : "hidden"}>
          {/* Root info */}
          {rootPath && (
            <div className="flex-shrink-0 px-4 py-2 border-b border-shell-border-subtle">
              <div className="flex items-center justify-between mb-1">
                 <p className="text-[11px] text-shell-text-muted uppercase tracking-wider font-semibold">
                    Workspace
                </p>
                <div className="flex items-center gap-1.5">
                   <StatPill label="F" value={statsLoading && !directoryStats ? ".." : String(directoryStats?.file_count ?? 0)} />
                   <StatPill label="S" value={statsLoading && !directoryStats ? ".." : formatBytes(directoryStats?.total_size ?? 0)} />
                </div>
              </div>
              <p className="text-[12px] text-shell-text-secondary truncate font-medium" title={rootPath}>
                {rootName}
              </p>
              
              <div className="relative mt-3">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-shell-text-muted" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter explorer..."
                  className="w-full rounded-lg border border-shell-border bg-shell-bg pl-9 pr-9 py-2 text-[12px] text-shell-text placeholder:text-shell-text-muted outline-none transition-colors focus:border-shell-accent/40"
                />
                {hasActiveSearch && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-shell-text-muted hover:text-shell-text hover:bg-shell-surface-hover transition-colors cursor-pointer"
                    title="Clear filter"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {formattedError && (
                <div className="mt-3 rounded-lg border border-shell-error/20 bg-shell-error/10 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-shell-error/80">
                    Explorer Error
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-shell-text-secondary">
                    {formattedError}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* File Tree */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            {loading && !fileTree.length ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={20} className="animate-spin text-shell-accent" />
              </div>
            ) : rootPath ? (
              filteredTree.length > 0 ? (
                <>
                  {!hasActiveSearch && (
                    <div className="mb-4">
                      <div className="px-5 py-2 mt-2 flex items-center justify-between gap-3 text-[10px] font-bold text-shell-text-muted uppercase tracking-widest">
                        <div className="flex items-center gap-2">
                          <Clock size={12} className="opacity-70" />
                          <span>Recent Files</span>
                        </div>
                        {recentFiles.length > 0 && (
                          <button
                            onClick={onClearRecentFiles}
                            className="text-[10px] font-bold uppercase tracking-[0.18em] text-shell-text-muted hover:text-shell-accent transition-colors cursor-pointer"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      {recentFiles.length > 0 ? (
                        <div className="px-2 space-y-0.5">
                          {recentFiles.map(file => (
                            <button
                              key={`recent-${file.path}`}
                              onClick={() => onFileSelect(file)}
                              className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                                activeFilePath === file.path 
                                  ? "bg-shell-accent/10 text-shell-accent" 
                                  : "text-shell-text-secondary hover:bg-shell-surface hover:text-shell-text"
                              }`}
                            >
                              <File size={13} className={activeFilePath === file.path ? "text-shell-accent" : "text-shell-text-muted"} />
                              <span className="text-[12px] truncate">{file.name}</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="mx-4 rounded-xl border border-dashed border-shell-border bg-shell-bg/40 px-4 py-3 text-[11px] leading-relaxed text-shell-text-muted">
                          Open files in this workspace and they will appear here for quick access.
                        </div>
                      )}
                    </div>
                  )}
                  {!hasActiveSearch && (
                    <div className="px-5 py-2 mt-2 flex items-center gap-2 text-[10px] font-bold text-shell-text-muted uppercase tracking-widest border-t border-shell-border/40">
                      <span>Files</span>
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
                <div className="px-4 py-12 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-shell-surface-hover flex items-center justify-center">
                    <Search size={22} className="text-shell-text-muted" />
                  </div>
                  <p className="text-[12.5px] text-shell-text-muted leading-relaxed">
                    No files matched "{searchQuery.trim()}".
                  </p>
                </div>
              )
            ) : (
              <div className="px-4 py-12 text-center">
                <motion.div
                  animate={{ opacity: [0.6, 1, 0.6], scale: [0.98, 1.02, 0.98] }}
                  transition={{ ease: "easeInOut", duration: 3, repeat: Infinity }}
                  className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-shell-accent/10 to-purple-500/10 border border-shell-border flex items-center justify-center shadow-inner"
                >
                  <FolderSearch size={24} className="text-shell-accent/60" />
                </motion.div>
                <p className="text-[12.5px] text-shell-text-muted leading-relaxed max-w-[200px] mx-auto">
                  Select a root folder to begin exploring your coursework.
                </p>
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

      {/* Footer */}
      <div className="flex-shrink-0 px-4 py-2 border-t border-shell-border">
        <p className="text-[10px] text-shell-text-muted text-center">
          StudyShell v0.1.0
        </p>
      </div>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-shell-border bg-shell-surface-hover/50 px-2 py-1.5">
      <p className="text-shell-text-muted uppercase tracking-wider">{label}</p>
      <p className="mt-0.5 truncate text-[11px] font-semibold text-shell-text">{value}</p>
    </div>
  );
}
