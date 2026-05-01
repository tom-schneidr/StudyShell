import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  detail?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  detail,
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Focus the cancel button by default to prevent accidental deletion
      setTimeout(() => cancelRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onCancel();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          onKeyDown={handleKeyDown}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", duration: 0.4, bounce: 0.3 }}
            className="relative w-full max-w-sm glass-layer-2 overflow-hidden rounded-2xl shadow-2xl border border-shell-border"
          >
            <div className="bg-glow opacity-30 h-32" />
            <div className="relative p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-shell-error/10 text-shell-error">
                    <AlertTriangle size={20} />
                  </div>
                  <h2 className="text-lg font-bold text-shell-text tracking-tight">
                    {title}
                  </h2>
                </div>
                <button
                  onClick={onCancel}
                  className="p-1.5 rounded-lg text-shell-text-muted hover:text-shell-text hover:bg-shell-surface-hover transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <p className="text-[13px] text-shell-text-secondary leading-relaxed mb-2">
                {message}
              </p>
              {detail && (
                <p className="text-[11px] text-shell-text-muted font-mono bg-shell-bg/50 rounded-lg px-3 py-2 mb-4 truncate border border-shell-border">
                  {detail}
                </p>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 pt-4">
                <button
                  ref={cancelRef}
                  type="button"
                  onClick={onCancel}
                  className="flex-1 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-shell-text border border-shell-border hover:bg-shell-surface-hover transition-all active:scale-95 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onConfirm}
                  className="flex-1 px-4 py-2.5 rounded-xl text-[13px] font-bold text-white bg-shell-error hover:bg-red-500 shadow-lg shadow-shell-error/20 transition-all active:scale-95 cursor-pointer"
                >
                  {confirmLabel}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
