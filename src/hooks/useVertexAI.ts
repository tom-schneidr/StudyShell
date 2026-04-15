import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ChatMessage, VertexModel } from "../types";
import { generateId } from "../types";
import { getVertexConfigErrorMessage } from "../utils/aiConfig";
import { deserializeChatHistory, serializeChatHistory } from "../utils/aiHistory";

const CHAT_HISTORY_STORAGE_KEY = "studyshell.chatHistory";

export function useVertexAI() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<VertexModel>("gemini-3-flash-preview");
  const [useSearch, setUseSearch] = useState(false);
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);

  useEffect(() => {
    invoke<boolean>("check_vertex_config")
      .then(setIsConfigured)
      .catch(() => setIsConfigured(false));
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(CHAT_HISTORY_STORAGE_KEY);
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
        window.localStorage.removeItem(CHAT_HISTORY_STORAGE_KEY);
        return;
      }

      window.localStorage.setItem(CHAT_HISTORY_STORAGE_KEY, serializeChatHistory(messages));
    } catch {
      // Ignore storage failures so the chat UI remains usable.
    }
  }, [hasLoadedHistory, messages]);

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
    [ensureConfigured, model, useSearch]
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
    setModel,
    setUseSearch,
    checkConfig,
    summarizeFiles,
    generateStudyGuide,
    clearChat,
  };
}
