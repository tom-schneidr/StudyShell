import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { ChatMessage, VertexModel } from "../types";
import { generateId } from "../types";
import { getVertexConfigErrorMessage } from "../utils/aiConfig";
import { deserializeChatHistory, serializeChatHistory } from "../utils/aiHistory";
import {
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_USE_SEARCH,
  STORAGE_KEYS,
  parseStoredBoolean,
  parseStoredString,
  parseStoredVertexModel,
} from "../utils/appPreferences";

export function useVertexAI() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<VertexModel>(() =>
    parseStoredVertexModel(window.localStorage.getItem(STORAGE_KEYS.vertexModel)),
  );
  const [useSearch, setUseSearch] = useState(() =>
    parseStoredBoolean(window.localStorage.getItem(STORAGE_KEYS.useSearch), DEFAULT_USE_SEARCH),
  );
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState<string>(() =>
    parseStoredString(window.localStorage.getItem(STORAGE_KEYS.systemPrompt), DEFAULT_SYSTEM_PROMPT),
  );
  const streamAbortRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    invoke<boolean>("check_vertex_config")
      .then(setIsConfigured)
      .catch(() => setIsConfigured(false));
  }, []);

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
    window.localStorage.setItem(STORAGE_KEYS.vertexModel, model);
  }, [model]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.useSearch, String(useSearch));
  }, [useSearch]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.systemPrompt, systemPrompt);
  }, [systemPrompt]);

  const checkConfig = useCallback(async () => {
    try {
      const configured = await invoke<boolean>("check_vertex_config");
      setIsConfigured(configured);
      return configured;
    } catch {
      setIsConfigured(false);
      return false;
    }
  }, []);

  const ensureConfigured = useCallback(async () => {
    if (isConfigured === true) {
      return true;
    }

    const configured = await checkConfig();
    if (!configured) {
      setError(getVertexConfigErrorMessage());
    }

    return configured;
  }, [checkConfig, isConfigured]);

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
          model,
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
    [ensureConfigured, model, systemPrompt, useSearch]
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

      // Cleanup previous stream if any
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
                msg.id === assistantId ? { ...msg, content: accumulatedContent } : msg
              )
            );
          }
        );

        streamAbortRef.current = unlisten;

        await invoke("stream_chat_with_ai", {
          message: content,
          context: context || null,
          model,
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
    [ensureConfigured, model, systemPrompt, useSearch]
  );

  const summarizeFiles = useCallback(
    async (paths: string[]) => {
      if (!(await ensureConfigured())) {
        throw new Error(getVertexConfigErrorMessage());
      }

      setLoading(true);
      setError(null);
      try {
        const response = await invoke<string>("summarize_files", {
          paths,
          model,
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
    [ensureConfigured, model, useSearch]
  );

  const generateStudyGuide = useCallback(
    async (paths: string[]) => {
      if (!(await ensureConfigured())) {
        throw new Error(getVertexConfigErrorMessage());
      }

      setLoading(true);
      setError(null);
      try {
        const response = await invoke<string>("generate_study_guide", {
          paths,
          model,
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
    [ensureConfigured, model, useSearch]
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    loading,
    error,
    model,
    useSearch,
    isConfigured,
    sendMessage,
    sendMessageStreaming,
    setModel,
    setUseSearch,
    checkConfig,
    summarizeFiles,
    generateStudyGuide,
    clearChat,
    systemPrompt,
    setSystemPrompt,
  };
}
