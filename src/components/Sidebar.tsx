import { motion } from "framer-motion";
import {
  FolderSearch,
  RefreshCw,
  Loader2,
  ChevronLeft
} from "lucide-react";
import FileTree from "./FileTree";
import type { FileNode } from "../types";

interface SidebarProps {
  rootPath: string | null;
  fileTree: FileNode[];
  loading: boolean;
  activeFilePath: string | null;
  selectedSourcePaths: string[];
  onSelectRoot: () => void;
  onRefresh: () => void;
  onFileSelect: (node: FileNode) => void;
  onContextMenu: (e: React.MouseEvent, node: FileNode) => void;
  onToggleSource: (node: FileNode) => void;
  onCollapse: () => void;
}

export default function Sidebar({
  rootPath,
  fileTree,
  loading,
  activeFilePath,
  selectedSourcePaths,
  onSelectRoot,
  onRefresh,
  onFileSelect,
  onContextMenu,
  onToggleSource,
  onCollapse,
}: SidebarProps) {
  const rootName = rootPath ? rootPath.split(/[/\\]/).pop() : null;

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
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl
            text-[12.5px] font-semibold transition-all duration-200 cursor-pointer
            bg-shell-accent/10 text-shell-accent border border-shell-accent/20
            hover:bg-shell-accent/20 hover:border-shell-accent/30 shadow-sm"
          whileTap={{ scale: 0.97 }}
        >
          <FolderSearch size={16} />
          {rootPath ? "Change Folder" : "Select Root"}
        </motion.button>
      </div>

      {/* Root info */}
      {rootPath && (
        <div className="flex-shrink-0 px-4 py-2 border-b border-shell-border-subtle">
          <p className="text-[11px] text-shell-text-muted uppercase tracking-wider font-semibold">
            Explorer
          </p>
          <p className="text-[12px] text-shell-text-secondary truncate mt-0.5" title={rootPath}>
            {rootName}
          </p>
        </div>
      )}

      {/* File Tree */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {loading && !fileTree.length ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-shell-accent" />
          </div>
        ) : rootPath ? (
          <FileTree
            nodes={fileTree}
            activeFilePath={activeFilePath}
            selectedSourcePaths={selectedSourcePaths}
            onFileSelect={onFileSelect}
            onContextMenu={onContextMenu}
            onToggleSource={onToggleSource}
          />
        ) : (
          <div className="px-4 py-12 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-shell-surface-hover
              flex items-center justify-center">
              <FolderSearch size={24} className="text-shell-text-muted" />
            </div>
            <p className="text-[12.5px] text-shell-text-muted leading-relaxed">
              Select a root folder to begin exploring your coursework.
            </p>
          </div>
        )}
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
