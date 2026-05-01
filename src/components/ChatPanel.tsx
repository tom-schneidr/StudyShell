import { useState, useRef, useEffect, useCallback } from "react";
import { marked } from "marked";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Trash2,
  Sparkles,
  Send,
  Loader2,
  AlertCircle,
  Bot,
  User,
  ChevronDown,
  ChevronRight,
  Globe,
  Layers,
} from "lucide-react";
import type { FileNode, ChatMessage, VertexModel } from "../types";
import { modelLabels } from "../types";
import { getChatPlaceholder, vertexConfigGuidance } from "../utils/aiConfig";
import { canClearSelectedSources, getSelectedSourcesSummary } from "../utils/sourceSelection";

interface ChatPanelProps {
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  model: VertexModel;
  isConfigured: boolean | null;
  activeFileName: string | null;
  activeFileContent: string | null;
  selectedSources: FileNode[];
  useSearch: boolean;
  onSendMessage: (message: string) => void | Promise<void>;
  onModelChange: (model: VertexModel) => void;
  onSearchChange: (useSearch: boolean) => void;
  onClearChat: () => void;
  canClearChat: boolean;
  onSummarizeCurrentFile: () => void;
  onGenerateFlashcards: () => void;
  onRemoveSource: (path: string) => void;
  onClearSources: () => void;
  onCollapse: () => void;
}

export default function ChatPanel({
  messages,
  loading,
  error,
  model,
  isConfigured,
  activeFileName,
  activeFileContent,
  selectedSources,
  useSearch,
  onSendMessage,
  onModelChange,
  onSearchChange,
  onClearChat,
  canClearChat,
  onSummarizeCurrentFile,
  onGenerateFlashcards,
  onRemoveSource,
  onClearSources,
  onCollapse,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [showModelPicker, setShowModelPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const modelPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  useEffect(() => {
    if (!showModelPicker) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!modelPickerRef.current?.contains(event.target as Node)) {
        setShowModelPicker(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowModelPicker(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showModelPicker]);

  const aiUnavailable = isConfigured !== true;
  const checkingConfiguration = isConfigured === null;
  const inputDisabled = loading || aiUnavailable;
  const showClearSources = canClearSelectedSources(selectedSources.length);
  const selectedSourcesSummary = getSelectedSourcesSummary(selectedSources.length);

  const handleSend = useCallback(() => {
    if (!input.trim() || inputDisabled) return;
    void onSendMessage(input.trim());
    setInput("");
  }, [input, inputDisabled, onSendMessage]);

  return (
    <div className="h-full w-full flex flex-col bg-shell-surface overflow-hidden">
      <div className="flex-shrink-0 px-5 pt-8 pb-4 border-b border-shell-border bg-shell-bg/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-[14px] font-bold text-shell-text tracking-tight whitespace-nowrap">AI Assistant</h2>
              <p className="text-[10px] text-shell-text-muted font-bold uppercase tracking-widest opacity-70">Multimodal</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onClearChat}
              disabled={!canClearChat}
              className={`p-2 rounded-lg transition-all ${
                canClearChat
                  ? "cursor-pointer text-shell-text-muted hover:text-red-400 hover:bg-red-400/10"
                  : "cursor-not-allowed text-shell-text-muted/40"
              }`}
              title={canClearChat ? "Clear chat history" : "No chat history to clear"}
            >
              <Trash2 size={16} />
            </button>
            <button onClick={onCollapse} className="p-2 rounded-lg text-shell-text-muted hover:text-shell-text hover:bg-shell-surface-hover transition-all cursor-pointer">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {activeFileName && activeFileContent && (
            <div className="flex gap-2">
              <button
                onClick={onSummarizeCurrentFile}
                disabled={aiUnavailable}
                className={`flex-1 flex items-center justify-between px-3 py-2 rounded-lg bg-shell-bg border border-shell-border text-[11px] transition-all ${
                  aiUnavailable
                    ? "text-shell-text-muted/50 cursor-not-allowed opacity-60"
                    : "text-shell-text-muted hover:text-shell-text cursor-pointer"
                }`}
              >
                <span className="truncate pr-2">Summarize</span>
                <Sparkles size={12} className="flex-shrink-0" />
              </button>
              <button
                onClick={onGenerateFlashcards}
                disabled={aiUnavailable}
                className={`flex-1 flex items-center justify-between px-3 py-2 rounded-lg bg-shell-bg border border-shell-border text-[11px] transition-all ${
                  aiUnavailable
                    ? "text-shell-text-muted/50 cursor-not-allowed opacity-60"
                    : "text-shell-text-muted hover:text-shell-text cursor-pointer"
                }`}
              >
                <span className="truncate pr-2">Flashcards</span>
                <Layers size={12} className="flex-shrink-0" />
              </button>
            </div>
          )}

          <div ref={modelPickerRef} className="relative">
            <button
              onClick={() => setShowModelPicker(!showModelPicker)}
              aria-expanded={showModelPicker}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-shell-bg border border-shell-border text-[11.5px] text-shell-text-secondary hover:text-shell-text transition-all cursor-pointer"
            >
              <span className="font-medium">{modelLabels[model]}</span>
              <ChevronDown size={14} className={`transition-transform ${showModelPicker ? "rotate-180" : ""}`} />
            </button>

            <AnimatePresence>
              {showModelPicker && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full left-0 right-0 mt-2 z-50 glass rounded-xl border border-shell-border shadow-2xl overflow-hidden"
                >
                  {(Object.entries(modelLabels) as [VertexModel, string][]).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => {
                        onModelChange(key);
                        setShowModelPicker(false);
                      }}
                      className={`w-full px-4 py-2.5 text-left text-[12px] transition-colors hover:bg-shell-accent/10 hover:text-shell-accent ${
                        model === key ? "text-shell-accent bg-shell-accent/5 font-semibold" : "text-shell-text-secondary"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {aiUnavailable && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-3 text-[11px] leading-relaxed text-amber-200">
              {checkingConfiguration ? (
                <Loader2 size={15} className="mt-0.5 flex-shrink-0 animate-spin" />
              ) : (
                <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
              )}
              <div>
                <p className="font-semibold text-amber-100">
                  {checkingConfiguration ? "Checking Vertex AI setup..." : "Vertex AI setup required"}
                </p>
                <p className="mt-1 text-amber-100/80">{vertexConfigGuidance}</p>
              </div>
            </div>
          )}

          <button
            onClick={() => onSearchChange(!useSearch)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-all cursor-pointer ${
              useSearch
                ? "bg-shell-accent/10 border-shell-accent/30 text-shell-accent shadow-sm"
                : "bg-shell-bg border-shell-border text-shell-text-muted hover:text-shell-text"
            }`}
          >
            <div className="flex items-center gap-2 text-[11px] font-medium">
              <Globe size={13} className={useSearch ? "animate-pulse" : ""} />
              <span>Google Search Grounding</span>
            </div>
            <div className={`w-8 h-4 rounded-full relative transition-colors ${useSearch ? "bg-shell-accent" : "bg-shell-border"}`}>
              <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${useSearch ? "left-[18px]" : "left-0.5"}`} />
            </div>
          </button>
        </div>

        {selectedSources.length > 0 && (
          <>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-shell-text-muted">
                {selectedSourcesSummary}
              </p>
              {showClearSources && (
                <button
                  onClick={onClearSources}
                  className="text-[10px] font-bold uppercase tracking-[0.18em] text-shell-text-muted hover:text-shell-accent transition-colors cursor-pointer"
                >
                  Clear Sources
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-2 max-h-[80px] overflow-y-auto pr-1 custom-scrollbar">
              {selectedSources.map((source) => (
                <div key={source.path} className="flex items-center gap-2 px-2.5 py-1 bg-shell-accent/10 border border-shell-accent/20 rounded-full text-[10px] text-shell-accent font-medium">
                  <span className="truncate max-w-[120px]">{source.name}</span>
                  <button onClick={() => onRemoveSource(source.path)} className="p-0.5 hover:text-emerald-400 transition-colors cursor-pointer">
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 custom-scrollbar space-y-6 bg-shell-bg/20 min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-10 animate-in fade-in zoom-in-95 duration-500">
            <div className="w-16 h-16 rounded-3xl bg-shell-accent/10 flex items-center justify-center mb-6 shadow-inner">
              <Bot size={32} className="text-shell-accent/40" />
            </div>
            <h3 className="text-base font-bold text-shell-text mb-2">How can I help you today?</h3>
            <p className="text-[12px] text-shell-text-muted leading-relaxed max-w-[240px]">
              Toggled StudyGrounding? Select sources or search the web to enhance your research.
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div 
                layout
                initial={{ opacity: 0, y: 15, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                key={msg.id} 
                className={`flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
              >
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center shadow-sm ${
                    msg.role === "user" ? "bg-shell-accent text-white" : "bg-shell-surface border border-shell-border text-shell-accent"
                  }`}
                >
                  {msg.role === "user" ? <User size={16} /> : <Bot size={16} />}
                </div>
                <div
                  className={`max-w-[88%] rounded-2xl px-5 py-3.5 text-[13px] leading-[1.6] shadow-sm ${
                    msg.role === "user" ? "bg-shell-accent text-white rounded-tr-none" : "bg-shell-surface text-shell-text border border-shell-border rounded-tl-none shadow-black/10"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="ai-markdown" dangerouslySetInnerHTML={{ __html: marked.parse(msg.content) }} />
                  ) : (
                    msg.content
                  )}
                </div>
              </motion.div>
            ))}
            
            {loading && (
              <motion.div
                layout
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="flex gap-4"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center shadow-sm bg-shell-surface border border-shell-border text-shell-accent">
                  <Bot size={16} />
                </div>
                <div className="rounded-2xl px-5 py-3.5 shadow-sm bg-shell-surface border border-shell-border rounded-tl-none shadow-black/10 flex items-center gap-1.5 h-[46px]">
                  <motion.div className="w-1.5 h-1.5 bg-shell-text-muted/60 rounded-full" animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} />
                  <motion.div className="w-1.5 h-1.5 bg-shell-text-muted/60 rounded-full" animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} />
                  <motion.div className="w-1.5 h-1.5 bg-shell-text-muted/60 rounded-full" animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex-shrink-0 p-5 bg-shell-bg border-t border-shell-border shadow-[0_-10px_40px_rgba(0,0,0,0.1)] mb-1">
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-red-400 text-[11px] font-medium leading-normal">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="relative">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={inputDisabled}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={getChatPlaceholder(isConfigured, useSearch)}
            className="w-full bg-shell-surface border border-shell-border rounded-2xl pl-5 pr-14 py-4
              text-[13px] text-shell-text placeholder:text-shell-text-muted focus:outline-none
              focus:ring-2 focus:ring-shell-accent/40 focus:border-shell-accent transition-all resize-none shadow-inner disabled:cursor-not-allowed disabled:opacity-60"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || inputDisabled}
            className="absolute right-3 top-[10px] p-2.5 rounded-xl bg-shell-accent
              text-white shadow-xl shadow-shell-accent/20 hover:bg-shell-accent-hover
              active:scale-95 disabled:opacity-30 transition-all cursor-pointer"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
        <div className="mt-3 flex justify-center gap-4">
          {activeFileName && (
            <span className="px-2 py-1 rounded bg-shell-surface text-[9px] text-shell-text-muted font-bold uppercase tracking-widest border border-shell-border/40 truncate max-w-[140px]">
              {activeFileName}
            </span>
          )}
          <span className="px-2 py-1 rounded bg-shell-surface flex items-center gap-1.5 text-[9px] text-shell-text-muted font-bold uppercase tracking-widest border border-shell-border/40">
            <div className={`w-1.5 h-1.5 rounded-full ${useSearch ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-shell-text-muted"}`} />
            Search {useSearch ? "ON" : "OFF"}
          </span>
          <span className="px-2 py-1 rounded bg-shell-surface text-[9px] text-shell-text-muted font-bold uppercase tracking-widest border border-shell-border/40">
            {checkingConfiguration
              ? "AI Checking"
              : isConfigured
                ? `${modelLabels[model]} Ready`
                : "AI Setup Required"}
          </span>
        </div>
      </div>
    </div>
  );
}
