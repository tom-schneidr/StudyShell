import { useState, useRef, useEffect, useCallback } from "react";
import { marked } from "marked";
import {
  X,
  Trash2,
  Send,
  Loader2,
  AlertCircle,
  Bot,
  User,
  ChevronRight,
  Globe,
  Layers,
  Sparkles,
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
      <div className="flex-shrink-0 px-3 py-2.5 border-b border-shell-border space-y-2">
        <div className="flex items-center gap-2">
          <h2 className="flex-1 text-[13px] font-medium text-shell-text">Chat</h2>
          <button
            type="button"
            onClick={() => onSearchChange(!useSearch)}
            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
              useSearch
                ? "text-shell-accent bg-shell-accent/10"
                : "text-shell-text-muted hover:text-shell-text hover:bg-shell-surface-hover"
            }`}
            title={useSearch ? "Web search on" : "Web search off"}
          >
            <Globe size={14} />
          </button>
          <button
            type="button"
            onClick={onClearChat}
            disabled={!canClearChat}
            className={`p-1.5 rounded-md transition-colors ${
              canClearChat
                ? "cursor-pointer text-shell-text-muted hover:text-shell-text hover:bg-shell-surface-hover"
                : "cursor-not-allowed text-shell-text-muted/40"
            }`}
            title="Clear chat"
          >
            <Trash2 size={14} />
          </button>
          <button
            type="button"
            onClick={onCollapse}
            className="p-1.5 rounded-md text-shell-text-muted hover:text-shell-text hover:bg-shell-surface-hover transition-colors cursor-pointer"
            title="Hide chat"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        <FreeRouterStatus
          aiStatus={aiStatus}
          isConfigured={isConfigured}
          onRefresh={onRefreshAiStatus}
        />

        {activeFileName && activeFileContent && (
          <div className="flex gap-1">
            <ActionChip
              label="Summarize"
              icon={<Sparkles size={12} />}
              disabled={aiUnavailable}
              onClick={onSummarizeCurrentFile}
            />
            <ActionChip
              label="Flashcards"
              icon={<Layers size={12} />}
              disabled={aiUnavailable}
              onClick={onGenerateFlashcards}
            />
          </div>
        )}

        {selectedSources.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-shell-text-muted">{selectedSourcesSummary}</span>
              {showClearSources && (
                <button
                  type="button"
                  onClick={onClearSources}
                  className="text-[11px] text-shell-text-muted hover:text-shell-text cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1 max-h-[72px] overflow-y-auto">
              {selectedSources.map((source) => (
                <span
                  key={source.path}
                  className="inline-flex items-center gap-1 max-w-[140px] pl-2 pr-1 py-0.5 rounded-md bg-shell-bg border border-shell-border text-[11px] text-shell-text-secondary"
                >
                  <span className="truncate">{source.name}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveSource(source.path)}
                    className="p-0.5 text-shell-text-muted hover:text-shell-text cursor-pointer"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-[12px] text-shell-text-muted text-center py-8">
            Ask about your open files. Routed through {FREEROUTER_PRODUCT_NAME}.
          </p>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
          >
            <div
              className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${
                msg.role === "user"
                  ? "bg-shell-accent/15 text-shell-accent"
                  : "bg-shell-bg text-shell-text-muted"
              }`}
            >
              {msg.role === "user" ? <User size={12} /> : <Bot size={12} />}
            </div>
            <div
              className={`max-w-[88%] rounded-lg px-3 py-2 text-[13px] leading-relaxed ${
                msg.role === "user"
                  ? "bg-shell-accent/10 text-shell-text"
                  : "bg-shell-bg text-shell-text-secondary border border-shell-border"
              }`}
            >
              {msg.role === "assistant" ? (
                <div
                  className="ai-markdown"
                  dangerouslySetInnerHTML={{ __html: marked.parse(msg.content) as string }}
                />
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2 items-center text-[12px] text-shell-text-muted">
            <Loader2 size={14} className="animate-spin" />
            <span>Thinking…</span>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 px-2 py-2 rounded-md bg-red-500/10 text-[12px] text-red-300">
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="flex-shrink-0 px-3 py-3 border-t border-shell-border">
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
            className="w-full bg-shell-bg border border-shell-border rounded-lg pl-3 pr-11 py-2.5
              text-[13px] text-shell-text placeholder:text-shell-text-muted focus:outline-none
              focus:border-shell-accent/50 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || inputDisabled}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md bg-shell-accent text-white
              hover:bg-shell-accent-hover disabled:opacity-30 transition-colors cursor-pointer"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
        {activeFileName && (
          <p className="mt-1.5 text-[11px] text-shell-text-muted truncate" title={activeFileName}>
            Context: {activeFileName}
          </p>
        )}
      </div>
    </div>
  );
}

function ActionChip({
  label,
  icon,
  disabled,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md border text-[11px] transition-colors ${
        disabled
          ? "border-shell-border text-shell-text-muted/50 cursor-not-allowed"
          : "border-shell-border text-shell-text-secondary hover:bg-shell-surface-hover hover:text-shell-text cursor-pointer"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
