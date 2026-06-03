import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { ChatMessage } from "../types";
import { generateId } from "../types";
import { getAiConfigErrorMessage } from "../utils/aiConfig";
import { deserializeChatHistory, serializeChatHistory } from "../utils/aiHistory";
import {
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_USE_SEARCH,
  STORAGE_KEYS,
  parseStoredBoolean,
  parseStoredString,
} from "../utils/appPreferences";
import { FREEROUTER_DEFAULT_BASE_URL, FREEROUTER_MODEL } from "../utils/freerouter";

export interface AiStatus {
  baseUrl: string;
  reachable: boolean;
  model: typeof FREEROUTER_MODEL;
}

function normalizeAiStatus(raw: {
  base_url: string;
  reachable: boolean;
  model: string;
}): AiStatus {
  return {
    baseUrl: raw.base_url || FREEROUTER_DEFAULT_BASE_URL,
    reachable: raw.reachable,
    model: FREEROUTER_MODEL,
  };
}

export function useStudyAI() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useSearch, setUseSearch] = useState(() =>
    parseStoredBoolean(window.localStorage.getItem(STORAGE_KEYS.useSearch), DEFAULT_USE_SEARCH),
  );
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState<string>(() =>
    parseStoredString(window.localStorage.getItem(STORAGE_KEYS.systemPrompt), DEFAULT_SYSTEM_PROMPT),
  );
  const streamAbortRef = useRef<(() => void) | null>(null);

  const isConfigured = aiStatus?.reachable ?? null;

  const refreshAiStatus = useCallback(async () => {
    try {
      const status = await invoke<{ base_url: string; reachable: boolean; model: string }>(
        "get_ai_status",
      );
      const normalized = normalizeAiStatus(status);
      setAiStatus(normalized);
      return normalized;
    } catch {
      setAiStatus({
        baseUrl: FREEROUTER_DEFAULT_BASE_URL,
        reachable: false,
        model: FREEROUTER_MODEL,
      });
      return null;
    }
  }, []);

  useEffect(() => {
    void refreshAiStatus();
  }, [refreshAiStatus]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEYS.chatHistory);
      if (stored) {
        setMessages(deserializeChatHistory(stored));
      }
    } catch {
      setMessages([]);
    } finally {
      setHasLoadedHistory(true);
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedHistory) {
      return;
    }

    try {
      if (messages.length === 0) {
        window.localStorage.removeItem(STORAGE_KEYS.chatHistory);
        return;
      }

      window.localStorage.setItem(STORAGE_KEYS.chatHistory, serializeChatHistory(messages));
    } catch {
      // Ignore storage failures so the chat UI remains usable.
    }
  }, [hasLoadedHistory, messages]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.useSearch, String(useSearch));
  }, [useSearch]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.systemPrompt, systemPrompt);
  }, [systemPrompt]);

  const ensureConfigured = useCallback(async () => {
    if (aiStatus?.reachable === true) {
      return true;
    }

    const status = await refreshAiStatus();
    if (!status?.reachable) {
      setError(getAiConfigErrorMessage());
    }

    return status?.reachable === true;
  }, [aiStatus?.reachable, refreshAiStatus]);

  const sendMessage = useCallback(
    async (content: string, context?: string) => {
      if (!content.trim()) return undefined;
      if (!(await ensureConfigured())) return undefined;

      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);
      setError(null);

      try {
        const response = await invoke<string>("chat_with_ai", {
          message: content,
          context: context || null,
          model: FREEROUTER_MODEL,
          useSearch,
          systemPrompt,
        });

        const assistantMessage: ChatMessage = {
          id: generateId(),
          role: "assistant",
          content: response,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
        return response;
      } catch (e) {
        setError(`AI request failed: ${e}`);
        const errorMessage: ChatMessage = {
          id: generateId(),
          role: "assistant",
          content: `Warning: ${e}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
        return undefined;
      } finally {
        setLoading(false);
      }
    },
    [ensureConfigured, systemPrompt, useSearch],
  );

  const sendMessageStreaming = useCallback(
    async (content: string, context?: string) => {
      if (!content.trim()) return;
      if (!(await ensureConfigured())) return;

      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content,
        timestamp: new Date(),
      };

      const assistantId = generateId();
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setLoading(true);
      setError(null);

      if (streamAbortRef.current) streamAbortRef.current();

      try {
        let accumulatedContent = "";

        const unlisten = await listen<{ chunk: string; done: boolean; error: string | null }>(
          "ai-stream-chunk",
          (event) => {
            if (event.payload.error) {
              setError(event.payload.error);
              setLoading(false);
              return;
            }

            if (event.payload.done) {
              setLoading(false);
              unlisten();
              streamAbortRef.current = null;
              return;
            }

            accumulatedContent += event.payload.chunk;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId ? { ...msg, content: accumulatedContent } : msg,
              ),
            );
          },
        );

        streamAbortRef.current = unlisten;

        await invoke("stream_chat_with_ai", {
          message: content,
          context: context || null,
          model: FREEROUTER_MODEL,
          useSearch,
          systemPrompt,
        });
      } catch (e) {
        setError(`Streaming failed: ${e}`);
        setLoading(false);
        if (streamAbortRef.current) {
          streamAbortRef.current();
          streamAbortRef.current = null;
        }
      }
    },
    [ensureConfigured, systemPrompt, useSearch],
  );

  const summarizeFiles = useCallback(
    async (paths: string[]) => {
      if (!(await ensureConfigured())) {
        throw new Error(getAiConfigErrorMessage());
      }

      setLoading(true);
      setError(null);
      try {
        const response = await invoke<string>("summarize_files", {
          paths,
          model: FREEROUTER_MODEL,
          useSearch,
        });
        const assistantMsg: ChatMessage = {
          id: generateId(),
          role: "assistant",
          content: response,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        return response;
      } catch (err) {
        setError(typeof err === "string" ? err : "Summarization failed");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [ensureConfigured, useSearch],
  );

  const generateStudyGuide = useCallback(
    async (paths: string[]) => {
      if (!(await ensureConfigured())) {
        throw new Error(getAiConfigErrorMessage());
      }

      setLoading(true);
      setError(null);
      try {
        const response = await invoke<string>("generate_study_guide", {
          paths,
          model: FREEROUTER_MODEL,
          useSearch,
        });
        const assistantMsg: ChatMessage = {
          id: generateId(),
          role: "assistant",
          content: response,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        return response;
      } catch (err) {
        setError(typeof err === "string" ? err : "Study guide generation failed");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [ensureConfigured, useSearch],
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    loading,
    error,
    useSearch,
    isConfigured,
    aiStatus,
    refreshAiStatus,
    sendMessage,
    sendMessageStreaming,
    setUseSearch,
    summarizeFiles,
    generateStudyGuide,
    clearChat,
    systemPrompt,
    setSystemPrompt,
  };
}

export type StudyAI = ReturnType<typeof useStudyAI>;
