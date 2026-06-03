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
  ChevronRight,
  Globe,
  Layers,
} from "lucide-react";
import type { ChatMessage, FileNode } from "../types";
import { getChatPlaceholder } from "../utils/aiConfig";
import { FREEROUTER_PRODUCT_NAME } from "../utils/freerouter";
import { canClearSelectedSources, getSelectedSourcesSummary } from "../utils/sourceSelection";
import type { AiStatus } from "../hooks/useStudyAI";
import FreeRouterStatus from "./FreeRouterStatus";

interface ChatPanelProps {
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  aiStatus: AiStatus | null;
  isConfigured: boolean | null;
  activeFileName: string | null;
  activeFileContent: string | null;
  selectedSources: FileNode[];
  useSearch: boolean;
  onSendMessage: (message: string) => void | Promise<void>;
  onSearchChange: (useSearch: boolean) => void;
  onRefreshAiStatus?: () => void;
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
  aiStatus,
  isConfigured,
  activeFileName,
  activeFileContent,
  selectedSources,
  useSearch,
  onSendMessage,
  onSearchChange,
  onRefreshAiStatus,
  onClearChat,
  canClearChat,
  onSummarizeCurrentFile,
  onGenerateFlashcards,
  onRemoveSource,
  onClearSources,
  onCollapse,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

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
              <h2 className="text-[14px] font-bold text-shell-text tracking-tight whitespace-nowrap">
                AI Assistant
              </h2>
              <p className="text-[10px] text-shell-text-muted font-bold uppercase tracking-widest opacity-70">
                via {FREEROUTER_PRODUCT_NAME}
              </p>
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
            <button
              onClick={onCollapse}
              className="p-2 rounded-lg text-shell-text-muted hover:text-shell-text hover:bg-shell-surface-hover transition-all cursor-pointer"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <FreeRouterStatus
            aiStatus={aiStatus}
            isConfigured={isConfigured}
            onRefresh={onRefreshAiStatus}
          />

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

          {aiUnavailable && !checkingConfiguration && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-3 text-[11px] leading-relaxed text-amber-200">
              <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
              <p>Chat is disabled until {FREEROUTER_PRODUCT_NAME} is running.</p>
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
              <span>Web search via {FREEROUTER_PRODUCT_NAME}</span>
            </div>
            <div
              className={`w-8 h-4 rounded-full relative transition-colors ${useSearch ? "bg-shell-accent" : "bg-shell-border"}`}
            >
              <div
                className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${useSearch ? "left-[18px]" : "left-0.5"}`}
              />
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
                <div
                  key={source.path}
                  className="flex items-center gap-2 px-2.5 py-1 bg-shell-accent/10 border border-shell-accent/20 rounded-full text-[10px] text-shell-accent font-medium"
                >
                  <span className="truncate max-w-[120px]">{source.name}</span>
                  <button
                    onClick={() => onRemoveSource(source.path)}
                    className="p-0.5 hover:text-emerald-400 transition-colors cursor-pointer"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 custom-scrollbar">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center opacity-60">
            <Bot size={48} className="text-shell-text-muted mb-4" />
            <p className="text-[13px] text-shell-text-secondary font-medium">Ask about your study materials</p>
            <p className="text-[11px] text-shell-text-muted mt-1 max-w-[220px]">
              Answers are routed through {FREEROUTER_PRODUCT_NAME} using the <code className="text-shell-accent">auto</code>{" "}
              model.
            </p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  msg.role === "user"
                    ? "bg-shell-accent/20 text-shell-accent"
                    : "bg-shell-bg border border-shell-border text-shell-text-muted"
                }`}
              >
                {msg.role === "user" ? <User size={14} /> : <Bot size={14} />}
              </div>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed ${
                  msg.role === "user"
                    ? "bg-shell-accent/15 text-shell-text border border-shell-accent/20"
                    : "bg-shell-bg text-shell-text-secondary border border-shell-border prose prose-invert prose-sm max-w-none"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div dangerouslySetInnerHTML={{ __html: marked.parse(msg.content) as string }} />
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {loading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-lg bg-shell-bg border border-shell-border flex items-center justify-center">
              <Loader2 size={14} className="animate-spin text-shell-accent" />
            </div>
            <div className="px-4 py-3 rounded-2xl bg-shell-bg border border-shell-border text-[12px] text-shell-text-muted">
              {FREEROUTER_PRODUCT_NAME} is thinking…
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-[11px] text-red-300">
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="flex-shrink-0 px-5 pb-6 pt-2 border-t border-shell-border bg-shell-bg/30">
        <div className="relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={1}
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
        <div className="mt-3 flex justify-center gap-4 flex-wrap">
          {activeFileName && (
            <span className="px-2 py-1 rounded bg-shell-surface text-[9px] text-shell-text-muted font-bold uppercase tracking-widest border border-shell-border/40 truncate max-w-[140px]">
              {activeFileName}
            </span>
          )}
          <span className="px-2 py-1 rounded bg-shell-surface flex items-center gap-1.5 text-[9px] text-shell-text-muted font-bold uppercase tracking-widest border border-shell-border/40">
            <div
              className={`w-1.5 h-1.5 rounded-full ${useSearch ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-shell-text-muted"}`}
            />
            Search {useSearch ? "ON" : "OFF"}
          </span>
          <FreeRouterStatus
            aiStatus={aiStatus}
            isConfigured={isConfigured}
            compact
          />
        </div>
      </div>
    </div>
  );
}
