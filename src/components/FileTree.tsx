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
} from "lucide-react";
import type { FileNode } from "../types";

interface FileTreeProps {
  nodes: FileNode[];
  activeFilePath: string | null;
  onFileSelect: (node: FileNode) => void;
  onContextMenu: (e: React.MouseEvent, node: FileNode) => void;
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
    case "log":
      return <FileText size={15} className="text-shell-text-secondary" />;
    case "rs":
    case "py":
    case "js":
    case "ts":
    case "tsx":
    case "jsx":
    case "java":
    case "c":
    case "cpp":
    case "html":
    case "css":
      return <FileCode size={15} className="text-green-400" />;
    case "json":
    case "yaml":
    case "yml":
    case "toml":
      return <FileCode size={15} className="text-yellow-400" />;
    default:
      return <File size={15} className="text-shell-text-muted" />;
  }
}

function TreeNode({
  node,
  activeFilePath,
  onFileSelect,
  onContextMenu,
  depth = 0,
}: {
  node: FileNode;
  activeFilePath: string | null;
  onFileSelect: (node: FileNode) => void;
  onContextMenu: (e: React.MouseEvent, node: FileNode) => void;
  depth: number;
}) {
  const [isOpen, setIsOpen] = useState(depth < 1);
  const isActive = activeFilePath === node.path;

  const handleClick = useCallback(() => {
    if (node.is_dir) {
      setIsOpen((prev) => !prev);
    } else {
      onFileSelect(node);
    }
  }, [node, onFileSelect]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      onContextMenu(e, node);
    },
    [node, onContextMenu]
  );

  return (
    <div>
      <motion.div
        className={`
          flex items-center gap-1.5 py-[5px] pr-3 cursor-pointer select-none
          rounded-md transition-colors duration-150
          ${isActive
            ? "bg-shell-accent/10 text-shell-accent"
            : "text-shell-text-secondary hover:bg-shell-surface-hover hover:text-shell-text"
          }
        `}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        whileTap={{ scale: 0.98 }}
      >
        {node.is_dir ? (
          <>
            <motion.div
              initial={false}
              animate={{ rotate: isOpen ? 90 : 0 }}
              transition={{ duration: 0.15 }}
            >
              <ChevronRight size={14} className="text-shell-text-muted flex-shrink-0" />
            </motion.div>
            {isOpen ? (
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
        <span className="truncate text-[12.5px] font-medium">{node.name}</span>
      </motion.div>

      <AnimatePresence initial={false}>
        {node.is_dir && isOpen && node.children && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            {node.children.map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                activeFilePath={activeFilePath}
                onFileSelect={onFileSelect}
                onContextMenu={onContextMenu}
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
  onFileSelect,
  onContextMenu,
  depth = 0,
}: FileTreeProps) {
  if (nodes.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-shell-text-muted text-xs">
        No files found in this directory.
      </div>
    );
  }

  return (
    <div className="py-1">
      {nodes.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          activeFilePath={activeFilePath}
          onFileSelect={onFileSelect}
          onContextMenu={onContextMenu}
          depth={depth}
        />
      ))}
    </div>
  );
}
