import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Folder, FolderOpen, Sparkles } from "lucide-react";
import type { FileNode } from "../types";
import { FileTypeIcon } from "../utils/fileIcons";
import { canSelectSource } from "../utils/sourceSelection";

interface FileTreeProps {
  nodes: FileNode[];
  activeFilePath: string | null;
  selectedSourcePaths: string[];
  onFileSelect: (node: FileNode) => void;
  onContextMenu: (e: React.MouseEvent, node: FileNode) => void;
  onToggleSource: (node: FileNode) => void;
  forceExpandAll?: boolean;
  depth?: number;
}

function TreeNode({
  node,
  activeFilePath,
  selectedSourcePaths,
  onFileSelect,
  onContextMenu,
  onToggleSource,
  forceExpandAll = false,
  depth = 0,
}: {
  node: FileNode;
  activeFilePath: string | null;
  selectedSourcePaths: string[];
  onFileSelect: (node: FileNode) => void;
  onContextMenu: (e: React.MouseEvent, node: FileNode) => void;
  onToggleSource: (node: FileNode) => void;
  forceExpandAll?: boolean;
  depth: number;
}) {
  const [isOpen, setIsOpen] = useState(depth < 1);
  const isActive = activeFilePath === node.path;
  const isSelectedSource = selectedSourcePaths.includes(node.path);
  const isExpanded = forceExpandAll || isOpen;
  const canUseAsSource = canSelectSource(node);

  const handleClick = useCallback(() => {
    if (node.is_dir) {
      if (forceExpandAll) return;
      setIsOpen((prev) => !prev);
    } else {
      onFileSelect(node);
    }
  }, [node, onFileSelect, forceExpandAll]);

  return (
    <div>
      <div
        className={`group flex items-center gap-1 py-1 pr-2 cursor-pointer select-none rounded-md mx-1 ${
          isActive
            ? "bg-shell-accent/10 text-shell-accent"
            : "text-shell-text-secondary hover:bg-shell-surface-hover hover:text-shell-text"
        }`}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        onClick={handleClick}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu(e, node);
        }}
      >
        {node.is_dir ? (
          <>
            <ChevronRight
              size={13}
              className={`text-shell-text-muted flex-shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`}
            />
            {isExpanded ? (
              <FolderOpen size={14} className="text-shell-text-muted flex-shrink-0" />
            ) : (
              <Folder size={14} className="text-shell-text-muted flex-shrink-0" />
            )}
          </>
        ) : (
          <>
            <span className="w-[13px] flex-shrink-0" />
            <FileTypeIcon extension={node.extension} name={node.name} size={14} active={isActive} />
          </>
        )}
        <span className="truncate text-[12px] flex-1">{node.name}</span>

        {!node.is_dir && canUseAsSource && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSource(node);
            }}
            className={`p-0.5 rounded transition-opacity cursor-pointer ${
              isSelectedSource
                ? "text-shell-accent opacity-100"
                : "text-shell-text-muted opacity-0 group-hover:opacity-100 hover:opacity-100"
            }`}
            title="Add to chat context"
          >
            <Sparkles size={11} className={isSelectedSource ? "fill-shell-accent/20" : ""} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {node.is_dir && isExpanded && node.children && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: "hidden" }}
          >
            {node.children.map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                activeFilePath={activeFilePath}
                selectedSourcePaths={selectedSourcePaths}
                onFileSelect={onFileSelect}
                onContextMenu={onContextMenu}
                onToggleSource={onToggleSource}
                forceExpandAll={forceExpandAll}
                depth={depth + 1}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FileTree({
  nodes,
  activeFilePath,
  selectedSourcePaths,
  onFileSelect,
  onContextMenu,
  onToggleSource,
  forceExpandAll = false,
  depth = 0,
}: FileTreeProps) {
  return (
    <div className="py-1 group">
      {nodes.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          activeFilePath={activeFilePath}
          selectedSourcePaths={selectedSourcePaths}
          onFileSelect={onFileSelect}
          onContextMenu={onContextMenu}
          onToggleSource={onToggleSource}
          forceExpandAll={forceExpandAll}
          depth={depth}
        />
      ))}
    </div>
  );
}
