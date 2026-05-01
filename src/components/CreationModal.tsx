import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, FilePlus2, FolderPlus, AlertCircle, Pencil } from "lucide-react";

interface CreationModalProps {
  isOpen: boolean;
  mode: "file" | "folder" | "rename";
  suggestedName: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

export default function CreationModal({
  isOpen,
  mode,
  suggestedName,
  onConfirm,
  onCancel,
}: CreationModalProps) {
  const [name, setName] = useState(suggestedName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName(suggestedName);
      // Auto-focus and select the name (without extension if it's a file)
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          const dotIndex = suggestedName.lastIndexOf(".");
          if (mode !== "folder" && dotIndex > 0) {
            inputRef.current.setSelectionRange(0, dotIndex);
          } else {
            inputRef.current.select();
          }
        }
      }, 50);
    }
  }, [isOpen, suggestedName, mode]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (name.trim()) {
      onConfirm(name.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onCancel();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", duration: 0.4, bounce: 0.3 }}
            className="relative w-full max-w-md glass-layer-2 overflow-hidden rounded-2xl shadow-2xl border border-shell-border"
          >
            <div className="bg-glow opacity-30 h-40" />
            
            <div className="relative p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${
                    mode === "file" ? "bg-shell-accent/10 text-shell-accent" : 
                    mode === "folder" ? "bg-purple-500/10 text-purple-400" :
                    "bg-shell-warning/10 text-shell-warning"
                  }`}>
                    {mode === "file" ? <FilePlus2 size={20} /> : mode === "folder" ? <FolderPlus size={20} /> : <Pencil size={20} />}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-shell-text tracking-tight uppercase">
                      {mode === "rename" ? "Rename" : `Create New ${mode === "file" ? "Note" : "Folder"}`}
                    </h2>
                    <p className="text-[11px] text-shell-text-muted font-medium uppercase tracking-wider mt-0.5">
                      Enter a {mode === "rename" ? "new name" : `name for your new ${mode}`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onCancel}
                  className="p-1.5 rounded-lg text-shell-text-muted hover:text-shell-text hover:bg-shell-surface-hover transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="relative group">
                  <input
                    ref={inputRef}
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`e.g. ${mode === "file" ? "lecture-notes.md" : mode === "folder" ? "History 101" : "new-name.md"}`}
                    className="w-full bg-shell-bg/50 border border-shell-border px-4 py-3 pb-8 rounded-xl text-shell-text placeholder:text-shell-text-muted outline-none transition-all duration-300 focus:border-shell-accent/40 focus:bg-shell-bg/80 focus:shadow-lg focus:shadow-shell-accent/5 group-hover:border-shell-border/80"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {!name.trim() && (
                      <AlertCircle size={14} className="text-shell-error animate-pulse-subtle" />
                    )}
                  </div>
                  <div className="absolute bottom-2.5 left-4 flex items-center gap-2">
                     <span className="text-[9px] font-bold text-shell-text-muted uppercase tracking-[0.15em]">
                        {mode === "file" ? "Markdown Document" : mode === "folder" ? "Standard Directory" : "Rename Item"}
                     </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-shell-text border border-shell-border hover:bg-shell-surface-hover transition-all active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!name.trim()}
                    className={`flex-2 px-4 py-2.5 rounded-xl text-[13px] font-bold text-white transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 ${
                      mode === "rename" ? "bg-shell-warning hover:bg-yellow-500 shadow-lg shadow-shell-warning/20" : "bg-shell-accent hover:bg-shell-accent-hover shadow-lg shadow-shell-accent/20"
                    }`}
                  >
                    {mode === "rename" ? "Rename" : `Create ${mode === "file" ? "Note" : "Folder"}`}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
