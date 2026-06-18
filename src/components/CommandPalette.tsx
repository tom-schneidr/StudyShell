import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Command, ChevronRight, Zap, Lock } from "lucide-react";
import {
  commandMatchesQuery,
  getDefaultCommandIndex,
  getNextEnabledCommandIndex,
  hasCommandPaletteMatches,
} from "../utils/commandPalette";

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  category: string;
  shortcut?: string;
  disabled?: boolean;
  onSelect: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: CommandItem[];
}

export default function CommandPalette({ isOpen, onClose, commands }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(getDefaultCommandIndex(commands));
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [commands, isOpen]);

  const filteredCommands = commands.filter((cmd) => commandMatchesQuery(cmd, query));
  const hasMatches = hasCommandPaletteMatches(filteredCommands.length);

  useEffect(() => {
    setSelectedIndex(getDefaultCommandIndex(filteredCommands));
  }, [filteredCommands]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      if (!hasMatches) {
        return;
      }
      e.preventDefault();
      setSelectedIndex((prev) => getNextEnabledCommandIndex(filteredCommands, prev, 1));
    } else if (e.key === "ArrowUp") {
      if (!hasMatches) {
        return;
      }
      e.preventDefault();
      setSelectedIndex((prev) => getNextEnabledCommandIndex(filteredCommands, prev, -1));
    } else if (e.key === "Enter") {
      if (
        selectedIndex >= 0 &&
        filteredCommands[selectedIndex] &&
        !filteredCommands[selectedIndex].disabled
      ) {
        filteredCommands[selectedIndex].onSelect();
        onClose();
      }
    }
  };

  // Auto-scroll logic
  useEffect(() => {
    const selectedElement = listRef.current?.children[selectedIndex] as HTMLElement;
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-start justify-center pt-[15vh] px-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
          />

          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -10 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="relative w-full max-w-xl glass-layer-2 rounded-2xl shadow-2xl border border-shell-border overflow-hidden"
          >
            <div className="flex items-center px-4 py-3 border-b border-shell-border bg-shell-bg/20">
              <Search size={18} className="text-shell-text-muted mr-3" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a command or search..."
                className="flex-1 bg-transparent border-none outline-none text-[15px] text-shell-text placeholder:text-shell-text-muted"
              />
              <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded border border-shell-border bg-shell-surface/50 text-[10px] text-shell-text-muted font-bold">
                <Command size={10} />
                <span>K</span>
              </div>
            </div>

            <div ref={listRef} className="max-h-[400px] overflow-y-auto custom-scrollbar py-2">
              {filteredCommands.length > 0 ? (
                filteredCommands.map((cmd, index) => (
                  <button
                    key={cmd.id}
                    onClick={() => {
                      if (cmd.disabled) {
                        return;
                      }
                      cmd.onSelect();
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                    disabled={cmd.disabled}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all ${
                      index === selectedIndex
                        ? "bg-shell-accent/10 border-l-2 border-shell-accent"
                        : "border-l-2 border-transparent"
                    } ${cmd.disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <div
                      className={`p-2 rounded-xl scale-95 ${index === selectedIndex ? "bg-shell-accent/20 text-shell-accent" : "bg-shell-surface text-shell-text-muted"}`}
                    >
                      {cmd.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-[14px] font-medium ${index === selectedIndex ? "text-shell-text" : "text-shell-text-secondary"}`}
                        >
                          {cmd.label}
                        </span>
                        {cmd.shortcut && (
                          <span className="text-[10px] text-shell-text-muted whitespace-nowrap bg-shell-bg/50 px-1.5 py-0.5 rounded border border-shell-border">
                            {cmd.shortcut}
                          </span>
                        )}
                      </div>
                      {cmd.description && (
                        <p className="text-[11px] text-shell-text-muted truncate mt-0.5 font-medium opacity-80">
                          {cmd.category} &bull; {cmd.description}
                        </p>
                      )}
                    </div>
                    {cmd.disabled ? (
                      <Lock size={14} className="flex-shrink-0 text-shell-text-muted" />
                    ) : (
                      <ChevronRight
                        size={14}
                        className={`flex-shrink-0 transition-opacity ${index === selectedIndex ? "opacity-100 text-shell-accent" : "opacity-0"}`}
                      />
                    )}
                  </button>
                ))
              ) : (
                <div className="py-12 text-center">
                  <div className="mb-3 flex justify-center">
                    <Zap size={24} className="text-shell-text-muted opacity-20" />
                  </div>
                  <p className="text-[13px] text-shell-text-muted">
                    No commands found for "{query}"
                  </p>
                </div>
              )}
            </div>

            <div className="px-4 py-2 bg-shell-bg/40 border-t border-shell-border flex items-center justify-between">
              <div className="flex items-center gap-4 text-[10px] text-shell-text-muted font-bold uppercase tracking-wider">
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-shell-surface border border-shell-border">
                    Enter
                  </span>
                  <span>to select</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-shell-surface border border-shell-border">
                    Up/Down
                  </span>
                  <span>to navigate</span>
                </div>
              </div>
              <span className="text-[10px] text-shell-text-muted/50 font-mono">
                {filteredCommands.length} matches
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
