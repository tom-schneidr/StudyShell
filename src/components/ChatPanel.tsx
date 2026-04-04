import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Sparkles,
  Loader2,
  Trash2,
  ChevronDown,
  AlertCircle,
  FileText,
  Bot,
  User,
} from "lucide-react";
import type { ChatMessage, VertexModel } from "../types";

interface ChatPanelProps {
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  model: VertexModel;
  activeFileName: string | null;
  activeFileContent: string | null;
  onSendMessage: (message: string, context?: string) => void;
  onModelChange: (model: VertexModel) => void;
  onClearChat: () => void;
  onSummarizeCurrentFile: () => void;
}

export default function ChatPanel({
  messages,
  loading,
  error,
  model,
  activeFileName,
  activeFileContent,
  onSendMessage,
  onModelChange,
  onClearChat,
  onSummarizeCurrentFile,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [showModelPicker, setShowModelPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height =
        Math.min(inputRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  const handleSend = useCallback(() => {
    if (!input.trim() || loading) return;
    onSendMessage(input.trim(), activeFileContent || undefined);
    setInput("");
  }, [input, loading, onSendMessage, activeFileContent]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const modelLabels: Record<VertexModel, string> = {
    "gemini-2.5-pro": "Gemini 2.5 Pro",
    "gemini-2.5-flash": "Gemini 2.5 Flash",
    "gemini-2.5-flash-lite": "Gemini 2.5 Flash Lite",
    "gemini-3-flash": "Gemini 3 Flash (Preview)",
  };

  return (
    <div className="h-full flex flex-col bg-shell-surface border-l border-shell-border">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-shell-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-emerald-500 to-cyan-500
              flex items-center justify-center">
              <Sparkles size={12} className="text-white" />
            </div>
            <h2 className="text-sm font-semibold text-shell-text">
              AI Assistant
            </h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onClearChat}
              className="p-1.5 rounded-md text-shell-text-muted hover:text-shell-text
                hover:bg-shell-surface-hover transition-colors cursor-pointer"
              title="Clear chat"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Model Selector */}
        <div className="relative mt-2">
          <button
            onClick={() => setShowModelPicker(!showModelPicker)}
            className="w-full flex items-center justify-between px-2.5 py-1.5
              rounded-md bg-shell-bg border border-shell-border text-[11.5px]
              text-shell-text-secondary hover:text-shell-text transition-colors cursor-pointer"
          >
            <span>{modelLabels[model]}</span>
            <ChevronDown size={12} />
          </button>

          <AnimatePresence>
            {showModelPicker && (
              <motion.div
                className="absolute top-full left-0 right-0 mt-1 z-50 glass rounded-lg overflow-hidden
                  shadow-xl shadow-black/30"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.12 }}
              >
                {(
                  Object.entries(modelLabels) as [VertexModel, string][]
                ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => {
                      onModelChange(key);
                      setShowModelPicker(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-[12px] transition-colors cursor-pointer
                      ${
                        model === key
                          ? "bg-shell-accent/10 text-shell-accent"
                          : "text-shell-text-secondary hover:bg-shell-surface-hover hover:text-shell-text"
                      }`}
                  >
                    {label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Context indicator */}
        {activeFileName && (
          <div className="mt-2 flex items-center gap-1.5 px-2 py-1 rounded-md
            bg-shell-accent/5 border border-shell-accent/10">
            <FileText size={11} className="text-shell-accent" />
            <span className="text-[10.5px] text-shell-accent truncate">
              Context: {activeFileName}
            </span>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 ? (
          <EmptyChatState
            hasFile={!!activeFileName}
            onSummarize={onSummarizeCurrentFile}
          />
        ) : (
          messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))
        )}

        {loading && (
          <motion.div
            className="flex items-start gap-2"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-emerald-500/20 to-cyan-500/20
              flex items-center justify-center flex-shrink-0 mt-0.5">
              <Bot size={12} className="text-emerald-400" />
            </div>
            <div className="glass-subtle rounded-xl rounded-tl-sm px-3 py-2.5">
              <div className="flex items-center gap-2 text-shell-text-muted text-xs">
                <Loader2 size={12} className="animate-spin" />
                Thinking...
              </div>
            </div>
          </motion.div>
        )}

        {error && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg
            bg-shell-error/10 border border-shell-error/20 text-shell-error text-xs">
            <AlertCircle size={13} />
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      {activeFileName && messages.length === 0 && (
        <div className="flex-shrink-0 px-3 pb-2">
          <button
            onClick={onSummarizeCurrentFile}
            disabled={loading}
            className="w-full px-3 py-2 rounded-lg text-[12px] font-medium
              bg-shell-accent/10 text-shell-accent border border-shell-accent/20
              hover:bg-shell-accent/20 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Sparkles size={12} className="inline mr-1.5" />
            Summarize this file
          </button>
        </div>
      )}

      {/* Input */}
      <div className="flex-shrink-0 px-3 pb-3 pt-1">
        <div className="flex items-end gap-2 glass rounded-xl p-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your study materials..."
            rows={1}
            className="flex-1 bg-transparent text-[12.5px] text-shell-text
              placeholder-shell-text-muted resize-none outline-none min-h-[28px] max-h-[120px]
              py-1 px-1"
          />
          <motion.button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="p-2 rounded-lg bg-shell-accent text-white
              disabled:opacity-30 disabled:cursor-not-allowed
              hover:bg-shell-accent-hover transition-colors flex-shrink-0 cursor-pointer"
            whileTap={{ scale: 0.95 }}
          >
            <Send size={13} />
          </motion.button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <motion.div
      className={`flex items-start gap-2 ${isUser ? "flex-row-reverse" : ""}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div
        className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5
          ${
            isUser
              ? "bg-shell-accent/15"
              : "bg-gradient-to-br from-emerald-500/20 to-cyan-500/20"
          }`}
      >
        {isUser ? (
          <User size={12} className="text-shell-accent" />
        ) : (
          <Bot size={12} className="text-emerald-400" />
        )}
      </div>

      <div
        className={`max-w-[85%] rounded-xl px-3 py-2.5 text-[12.5px] leading-relaxed
          ${
            isUser
              ? "bg-shell-accent/15 text-shell-text rounded-tr-sm"
              : "glass-subtle text-shell-text rounded-tl-sm"
          }`}
      >
        <div className="whitespace-pre-wrap break-words">{message.content}</div>
        <div
          className={`text-[9.5px] mt-1.5 ${
            isUser ? "text-shell-accent/50 text-right" : "text-shell-text-muted"
          }`}
        >
          {message.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
    </motion.div>
  );
}

function EmptyChatState({
  hasFile,
}: {
  hasFile: boolean;
  onSummarize?: () => void;
}) {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center px-4">
        <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10
          border border-shell-border flex items-center justify-center">
          <Sparkles size={20} className="text-emerald-400/50" />
        </div>
        <p className="text-[12.5px] text-shell-text-secondary font-medium mb-1">
          AI Assistant
        </p>
        <p className="text-[11.5px] text-shell-text-muted leading-relaxed max-w-[220px]">
          {hasFile
            ? "Ask questions about the currently opened file, or use the summary button below."
            : "Open a file to provide context for the AI assistant."}
        </p>
      </div>
    </div>
  );
}
