import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Settings, Sparkles, Layout, Globe, Shield } from "lucide-react";
import { DEFAULT_SYSTEM_PROMPT } from "../utils/appPreferences";
import { aiConfigGuidance } from "../utils/aiConfig";
import { FREEROUTER_MODEL, FREEROUTER_PRODUCT_NAME } from "../utils/freerouter";
import type { AiStatus } from "../hooks/useStudyAI";
import FreeRouterStatus from "./FreeRouterStatus";

interface SettingsViewProps {
  isOpen: boolean;
  onClose: () => void;
  systemPrompt: string;
  onSystemPromptChange: (val: string) => void;
  theme: "dark" | "light";
  onThemeChange: (val: "dark" | "light") => void;
  aiStatus: AiStatus | null;
  isAiConfigured: boolean | null;
  onRefreshAiStatus?: () => void;
}

export default function SettingsView({
  isOpen,
  onClose,
  systemPrompt,
  onSystemPromptChange,
  theme,
  onThemeChange,
  aiStatus,
  isAiConfigured,
  onRefreshAiStatus,
}: SettingsViewProps) {
  const [localPrompt, setLocalPrompt] = useState(systemPrompt);
  const [localTheme, setLocalTheme] = useState(theme);

  useEffect(() => {
    setLocalPrompt(systemPrompt);
    setLocalTheme(theme);
  }, [systemPrompt, theme, isOpen]);

  const normalizedPrompt = localPrompt.trim() || DEFAULT_SYSTEM_PROMPT;
  const hasChanges = normalizedPrompt !== systemPrompt || localTheme !== theme;

  const handleSave = () => {
    onSystemPromptChange(normalizedPrompt);
    onThemeChange(localTheme);
    onClose();
  };

  const handleResetDraft = () => {
    setLocalPrompt(systemPrompt);
    setLocalTheme(theme);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
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
            className="relative w-full max-w-2xl glass rounded-2xl border border-shell-border shadow-2xl overflow-hidden flex flex-col h-[600px]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-shell-border bg-shell-surface/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-shell-accent/10 text-shell-accent">
                  <Settings size={20} />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-shell-text">Settings</h2>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-shell-text-muted hover:text-shell-text hover:bg-shell-surface-hover transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content Container */}
            <div className="flex-1 flex overflow-hidden">
              {/* Sidebar */}
              <div className="w-48 bg-shell-bg/20 border-r border-shell-border p-3 flex flex-col gap-1">
                <SidebarItem icon={<Sparkles size={16} />} label="FreeRouter" active />
                <SidebarItem icon={<Layout size={16} />} label="Interface" />
                <SidebarItem icon={<Globe size={16} />} label="Network" />
                <SidebarItem icon={<Shield size={16} />} label="Privacy" />
              </div>

              {/* Main Settings Area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                {/* section: AI */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-shell-accent" />
                    <h3 className="text-sm font-medium text-shell-text">
                      {FREEROUTER_PRODUCT_NAME}
                    </h3>
                  </div>

                  <FreeRouterStatus
                    aiStatus={aiStatus}
                    isConfigured={isAiConfigured}
                    onRefresh={onRefreshAiStatus}
                  />

                  <p className="text-[11px] text-shell-text-muted leading-relaxed">
                    StudyShell sends all AI requests to your local {FREEROUTER_PRODUCT_NAME} gateway
                    using the <code className="text-shell-accent">{FREEROUTER_MODEL}</code> model.
                    Provider API keys and routing are configured in FreeRouter, not here.{" "}
                    {aiConfigGuidance}
                  </p>

                  <div className="space-y-2 pt-2">
                    <label className="text-[13px] text-shell-text-secondary font-medium">
                      System prompt
                    </label>
                    <label className="text-[13px] text-shell-text-secondary font-medium">
                      System Role / Instructions
                    </label>
                    <textarea
                      value={localPrompt}
                      onChange={(e) => setLocalPrompt(e.target.value)}
                      className="w-full h-32 p-3 rounded-xl bg-shell-bg border border-shell-border text-[13px] text-shell-text placeholder:text-shell-text-muted outline-none focus:border-shell-accent/40 resize-none leading-relaxed"
                      placeholder="e.g. You are a helpful professor specializing in Chemistry..."
                    />
                    <p className="text-[11px] text-shell-text-muted italic">
                      This prompt defines the AI's persona and logic globally.
                    </p>
                  </div>
                </section>

                {/* section: Appearance */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Layout size={16} className="text-shell-accent" />
                    <h3 className="text-sm font-medium text-shell-text">Appearance</h3>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl bg-shell-bg/40 border border-shell-border">
                    <div className="space-y-1">
                      <p className="text-[13px] font-bold text-shell-text">Dark / Light Mode</p>
                      <p className="text-[11px] text-shell-text-muted">
                        Choose your preferred visual theme
                      </p>
                    </div>
                    <div className="flex gap-1 p-1 rounded-lg bg-shell-surface border border-shell-border">
                      <button
                        onClick={() => setLocalTheme("dark")}
                        className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition-all ${localTheme === "dark" ? "bg-shell-accent text-white shadow-sm" : "text-shell-text-muted hover:text-shell-text"}`}
                      >
                        DARK
                      </button>
                      <button
                        onClick={() => setLocalTheme("light")}
                        className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition-all ${localTheme === "light" ? "bg-shell-accent text-white shadow-sm" : "text-shell-text-muted hover:text-shell-text"}`}
                      >
                        LIGHT
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-shell-surface/50 border-t border-shell-border flex items-center justify-end gap-3">
              <button
                onClick={handleResetDraft}
                disabled={!hasChanges}
                className="px-4 py-2 rounded-xl text-[13px] font-bold text-shell-text-secondary hover:text-shell-text hover:bg-shell-surface-hover transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reset Draft
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-[13px] font-bold text-shell-text-secondary hover:text-shell-text hover:bg-shell-surface-hover transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!hasChanges}
                className="px-6 py-2 rounded-xl bg-shell-accent text-white text-[13px] font-bold shadow-lg shadow-shell-accent/20 hover:bg-shell-accent/90 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Apply Changes
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function SidebarItem({
  icon,
  label,
  active = false,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors cursor-pointer ${active ? "bg-shell-accent/10 text-shell-accent shadow-sm" : "text-shell-text-muted hover:bg-shell-surface-hover hover:text-shell-text"}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
