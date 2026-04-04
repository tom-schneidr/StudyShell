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
  ChevronDown
} from "lucide-react";
import type { FileNode, ChatMessage, VertexModel } from "../types";
import { modelLabels } from "../types";
import { useState, useRef, useEffect, useCallback } from "react";

interface ChatPanelProps {
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  model: VertexModel;
  activeFileName: string | null;
  activeFileContent: string | null;
  selectedSources: FileNode[];
  onSendMessage: (message: string, context?: string) => void;
  onModelChange: (model: VertexModel) => void;
  onClearChat: () => void;
  onSummarizeCurrentFile: () => void;
  onRemoveSource: (path: string) => void;
}

export default function ChatPanel({
  messages,
  loading,
  error,
  model,
  activeFileName,
  activeFileContent,
  selectedSources,
  onSendMessage,
  onModelChange,
  onClearChat,
  onRemoveSource,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [showModelPicker, setShowModelPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  const handleSend = useCallback(() => {
    if (!input.trim() || loading) return;
    onSendMessage(input.trim(), activeFileContent || undefined);
    setInput("");
  }, [input, loading, onSendMessage, activeFileContent]);

  return (
    <div className="h-full w-full flex flex-col bg-shell-surface overflow-hidden">
      {/* Header - Modern with Padding */}
      <div className="flex-shrink-0 px-5 py-4 border-b border-shell-border bg-shell-bg/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Sparkles size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-[13px] font-bold text-shell-text tracking-tight">AI Assistant</h2>
              <p className="text-[10px] text-shell-text-muted font-medium uppercase tracking-wider">Multimodal Agent</p>
            </div>
          </div>
          <button onClick={onClearChat} className="p-2 rounded-lg text-shell-text-muted hover:text-red-400 hover:bg-red-400/10 transition-all cursor-pointer">
            <Trash2 size={15} />
          </button>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowModelPicker(!showModelPicker)}
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
                    onClick={() => { onModelChange(key); setShowModelPicker(false); }}
                    className={`w-full px-4 py-2.5 text-left text-[12px] transition-colors hover:bg-shell-accent/10 hover:text-shell-accent ${model === key ? "text-shell-accent bg-shell-accent/5 font-semibold" : "text-shell-text-secondary"}`}
                  >
                    {label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {selectedSources.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {selectedSources.map(s => (
              <div key={s.path} className="flex items-center gap-2 px-2.5 py-1 bg-shell-accent/10 border border-shell-accent/20 rounded-full text-[10px] text-shell-accent font-medium">
                <span className="truncate max-w-[120px]">{s.name}</span>
                <button onClick={() => onRemoveSource(s.path)} className="p-0.5 hover:text-white transition-colors cursor-pointer">
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Messages - Fixed Margins */}
      <div className="flex-1 overflow-y-auto px-5 py-6 custom-scrollbar space-y-6 bg-shell-bg/20">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-10 animate-in fade-in zoom-in-95 duration-500">
            <div className="w-16 h-16 rounded-3xl bg-shell-accent/10 flex items-center justify-center mb-6 shadow-inner">
              <Bot size={32} className="text-shell-accent/40" />
            </div>
            <h3 className="text-base font-bold text-shell-text mb-2">How can I help you today?</h3>
            <p className="text-[12px] text-shell-text-muted leading-relaxed max-w-[240px]">
              Upload PDFs or notes as sources and ask questions to prepare for your exams.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center shadow-sm ${
                msg.role === "user" ? "bg-shell-accent text-white" : "bg-shell-surface border border-shell-border text-shell-accent"
              }`}>
                {msg.role === "user" ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div className={`max-w-[88%] rounded-2xl px-5 py-3.5 text-[13px] leading-[1.6] shadow-sm animate-in slide-in-from-bottom-2 duration-300 ${
                msg.role === "user" ? "bg-shell-accent text-white rounded-tr-none" : "bg-shell-surface text-shell-text border border-shell-border rounded-tl-none shadow-black/10"
              }`}>
                {msg.content}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Control / Status Area - Pinned and Clear */}
      <div className="flex-shrink-0 p-5 bg-shell-bg border-t border-shell-border shadow-[0_-10px_40px_rgba(0,0,0,0.2)]">
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
            onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                }
            }}
            placeholder="Type your question..."
            className="w-full bg-shell-surface border border-shell-border rounded-2xl pl-5 pr-14 py-4
              text-[13px] text-shell-text placeholder:text-shell-text-muted focus:outline-none
              focus:ring-2 focus:ring-shell-accent/40 focus:border-shell-accent transition-all resize-none shadow-inner"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="absolute right-3 top-[10px] p-2.5 rounded-xl bg-shell-accent 
              text-white shadow-xl shadow-shell-accent/20 hover:bg-shell-accent-hover 
              active:scale-95 disabled:opacity-30 transition-all cursor-pointer"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
        <div className="mt-3 flex justify-center">
            <span className="px-2 py-0.5 rounded bg-shell-surface-hover text-[9px] text-shell-text-muted font-bold uppercase tracking-widest border border-shell-border/40">
                {modelLabels[model]} Ready
            </span>
        </div>
      </div>
    </div>
  );
}
