import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FilePlus2, FileText, BookOpen, FolderPlus, Trash2, Pencil, Copy, ArrowRight } from "lucide-react";
import type { FileNode } from "../types";
import { clampFloatingPosition } from "../utils/floatingPosition";

interface ContextMenuProps {
  x: number;
  y: number;
  node: FileNode | null;
  visible: boolean;
  onClose: () => void;
  onCreateNote: (node: FileNode) => void;
  onCreateFolder: (node: FileNode) => void;
  onRename: (node: FileNode) => void;
  onMove: (node: FileNode) => void;
  onCopyPath: (node: FileNode) => void;
  onDelete: (node: FileNode) => void;
  onGenerateSummary: (node: FileNode) => void;
  onCreateStudyGuide: (node: FileNode) => void;
  onOpenInSidePane?: (node: FileNode) => void;
  isSplit?: boolean;
}

export default function ContextMenu({
  x,
  y,
  node,
  visible,
  onClose,
  onCreateNote,
  onCreateFolder,
  onRename,
  onMove,
  onCopyPath,
  onDelete,
  onGenerateSummary,
  onCreateStudyGuide,
  onOpenInSidePane,
  isSplit,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (visible) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [visible, onClose]);

  if (!node) return null;

  const menuPosition = visible
    ? clampFloatingPosition(
        { x, y },
        {
          width: menuRef.current?.offsetWidth ?? 220,
          height: menuRef.current?.offsetHeight ?? 320,
        },
        { width: window.innerWidth, height: window.innerHeight },
      )
    : { x, y };

  const menuItems = [
    {
      icon: <FilePlus2 size={14} />,
      label: "New Markdown Note",
      onClick: () => {
        onCreateNote(node);
        onClose();
      },
    },
    {
      icon: <FolderPlus size={14} />,
      label: "New Folder",
      onClick: () => {
        onCreateFolder(node);
        onClose();
      },
    },
    {
      icon: <Pencil size={14} />,
      label: "Rename",
      onClick: () => {
        onRename(node);
        onClose();
      },
    },
    {
      icon: <ArrowRight size={14} />,
      label: "Move to...",
      onClick: () => {
        onMove(node);
        onClose();
      },
    },
    {
      icon: <Copy size={14} />,
      label: "Copy Path",
      onClick: () => {
        onCopyPath(node);
        onClose();
      },
    },
    {
      icon: <FileText size={14} />,
      label: "Generate Summary",
      onClick: () => {
        onGenerateSummary(node);
        onClose();
      },
    },
    {
      icon: <BookOpen size={14} />,
      label: "Create Study Guide",
      onClick: () => {
        onCreateStudyGuide(node);
        onClose();
      },
    },
    ...(!node.is_dir && onOpenInSidePane && !isSplit ? [{
      icon: <FilePlus2 size={14} />,
      label: "Open in Side Pane",
      onClick: () => {
        onOpenInSidePane(node);
        onClose();
      },
    }] : []),
  ];

  const dangerItems = [
    {
      icon: <Trash2 size={14} />,
      label: node.is_dir ? "Delete Folder" : "Delete File",
      onClick: () => {
        onDelete(node);
        onClose();
      },
    },
  ];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          ref={menuRef}
          className="fixed z-[9999] glass-layer-2 rounded-lg overflow-hidden shadow-2xl shadow-black/60 min-w-[200px]"
          style={{ left: menuPosition.x, top: menuPosition.y }}
          initial={{ opacity: 0, scale: 0.92, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: -4 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
        >
          <div className="px-3 py-2 border-b border-shell-border">
            <p className="text-[11px] text-shell-text-muted truncate font-medium">
              {node.name}
            </p>
          </div>
          <div className="py-1">
            {menuItems.map((item, i) => (
              <button
                key={i}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[12.5px] text-shell-text-secondary
                  hover:bg-shell-accent/10 hover:text-shell-accent transition-colors duration-100 cursor-pointer"
                onClick={item.onClick}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
          <div className="border-t border-shell-border py-1">
            {dangerItems.map((item, i) => (
              <button
                key={i}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[12.5px] text-shell-error/80
                  hover:bg-shell-error/10 hover:text-shell-error transition-colors duration-100 cursor-pointer"
                onClick={item.onClick}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
