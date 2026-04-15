import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  Folder,
  FolderOpen,
  FileText,
  FileType,
  File,
  FileCode,
  Sparkles
} from "lucide-react";
import type { FileNode } from "../types";

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

function getFileIcon(extension: string | null) {
  if (!extension) return <File size={15} className="text-shell-text-muted" />;
  switch (extension.toLowerCase()) {
    case "md":
    case "markdown":
      return <FileText size={15} className="text-blue-400" />;
    case "pdf":
      return <FileType size={15} className="text-red-400" />;
    case "txt":
    case "text":
      return <FileText size={15} className="text-shell-text-secondary" />;
    case "rs":
    case "py":
    case "js":
    case "ts":
    case "tsx":
    case "jsx":
      return <FileCode size={15} className="text-green-400" />;
    default:
      return <File size={15} className="text-shell-text-muted" />;
  }
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

  const handleClick = useCallback(() => {
    if (node.is_dir) {
      if (forceExpandAll) {
        return;
      }
      setIsOpen((prev) => !prev);
    } else {
      onFileSelect(node);
    }
  }, [node, onFileSelect, forceExpandAll]);

  return (
    <div>
      <motion.div
        className={`
          flex items-center gap-1.5 py-[5px] pr-3 cursor-pointer select-none
          rounded-md transition-colors duration-150 group
          ${isActive
            ? "bg-shell-accent/10 text-shell-accent"
            : "text-shell-text-secondary hover:bg-shell-surface-hover hover:text-shell-text"
          }
        `}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, node); }}
        whileTap={{ scale: 0.98 }}
      >
        {node.is_dir ? (
          <>
            <motion.div animate={{ rotate: isExpanded ? 90 : 0 }}>
              <ChevronRight size={14} className="text-shell-text-muted flex-shrink-0" />
            </motion.div>
            {isExpanded ? (
              <FolderOpen size={15} className="text-shell-accent flex-shrink-0" />
            ) : (
              <Folder size={15} className="text-shell-accent/70 flex-shrink-0" />
            )}
          </>
        ) : (
          <>
            <span className="w-[14px] flex-shrink-0" />
            {getFileIcon(node.extension)}
          </>
        )}
        <span className="truncate text-[12.5px] font-medium flex-1">{node.name}</span>
        
        {!node.is_dir && (
            <button
                onClick={(e) => { e.stopPropagation(); onToggleSource(node); }}
                className={`p-1 rounded hover:bg-shell-accent/20 transition-all cursor-pointer 
                ${isSelectedSource ? "text-shell-accent opacity-100" : "text-shell-text-muted opacity-0 group-hover:opacity-100"}`}
                title="Use as AI source"
            >
                <Sparkles size={12} className={isSelectedSource ? "fill-shell-accent/20" : ""} />
            </button>
        )}
      </motion.div>

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
    <div className="py-1">
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
