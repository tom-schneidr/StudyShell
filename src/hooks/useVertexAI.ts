import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ChatMessage, VertexModel } from "../types";
import { generateId } from "../types";

export function useVertexAI() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<VertexModel>("gemini-3-flash-preview");
  const [useSearch, setUseSearch] = useState(false);
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);

  // Check if Vertex AI is configured
  useEffect(() => {
    invoke<boolean>("check_vertex_config")
      .then(setIsConfigured)
      .catch(() => setIsConfigured(false));
  }, []);

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

  // Send a chat message
  const sendMessage = useCallback(
    async (content: string, context?: string) => {
      if (!content.trim()) return;

      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: content,
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
      } catch (e) {
        setError(`AI request failed: ${e}`);
        const errorMessage: ChatMessage = {
          id: generateId(),
          role: "assistant",
          content: `⚠️ Error: ${e}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setLoading(false);
      }
    },
    [model, useSearch]
  );

  // Summarize multiple files
  const summarizeFiles = useCallback(
    async (paths: string[]) => {
      setLoading(true);
      setError(null);
      try {
        const response = await invoke<string>("summarize_files", { 
          paths, 
          model,
          useSearch
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
    [model, useSearch]
  );

  // Generate study guide
  const generateStudyGuide = useCallback(
    async (paths: string[]) => {
      setLoading(true);
      setError(null);
      try {
        const response = await invoke<string>("generate_study_guide", { 
          paths, 
          model,
          useSearch
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
    [model, useSearch]
  );

  // Clear chat history
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
