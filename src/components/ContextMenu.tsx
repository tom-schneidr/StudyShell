import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, BookOpen } from "lucide-react";
import type { FileNode } from "../types";

interface ContextMenuProps {
  x: number;
  y: number;
  node: FileNode | null;
  visible: boolean;
  onClose: () => void;
  onGenerateSummary: (node: FileNode) => void;
  onCreateStudyGuide: (node: FileNode) => void;
}

export default function ContextMenu({
  x,
  y,
  node,
  visible,
  onClose,
  onGenerateSummary,
  onCreateStudyGuide,
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

  const menuItems = [
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
  ];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          ref={menuRef}
          className="fixed z-[9999] glass rounded-lg overflow-hidden shadow-2xl shadow-black/50 min-w-[200px]"
          style={{ left: x, top: y }}
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}
