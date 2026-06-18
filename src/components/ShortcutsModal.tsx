import { motion, AnimatePresence } from "framer-motion";
import { X, Keyboard, Command } from "lucide-react";

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const shortcuts = [
  { keys: ["Ctrl", "K"], description: "Open Command Palette" },
  { keys: ["Ctrl", "B"], description: "Toggle Sidebar" },
  { keys: ["Ctrl", "J"], description: "Toggle AI Assistant" },
  { keys: ["Ctrl", "W"], description: "Close Active Tab" },
  { keys: ["Ctrl", "/"], description: "Show Keyboard Shortcuts" },
  { keys: ["Ctrl", "S"], description: "Manual Save" },
  { keys: ["Esc"], description: "Close Modal / Cancel" },
];

export default function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg glass rounded-2xl border border-shell-border shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-shell-border bg-shell-surface/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-shell-accent/10 text-shell-accent">
                  <Keyboard size={20} />
                </div>
                <h2 className="text-lg font-bold text-shell-text tracking-tight">
                  Keyboard Shortcuts
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-shell-text-muted hover:text-shell-text hover:bg-shell-surface-hover transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 gap-2">
                {shortcuts.map((s, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-xl bg-shell-bg/40 border border-shell-border/40 hover:border-shell-accent/20 transition-all group"
                  >
                    <span className="text-[13px] text-shell-text-secondary group-hover:text-shell-text transition-colors capitalize">
                      {s.description}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {s.keys.map((key, kIdx) => (
                        <div key={kIdx} className="flex items-center gap-1.5">
                          <kbd className="min-w-[24px] px-1.5 py-1 rounded bg-shell-surface border border-shell-border text-[10px] font-bold text-shell-text-muted shadow-sm capitalize">
                            {key}
                          </kbd>
                          {kIdx < s.keys.length - 1 && (
                            <span className="text-[10px] text-shell-text-muted font-bold">+</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-4 bg-shell-surface/30 border-t border-shell-border flex items-center justify-center gap-2 text-[11px] text-shell-text-muted">
              <Command size={12} />
              <span>StudyShell Desktop Pro — Efficiency through Control</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
