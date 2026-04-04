import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ChatMessage, VertexModel } from "../types";
import { generateId } from "../types";

export function useVertexAI() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<VertexModel>("gemini-2.5-flash");
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);

  // Check if Vertex AI is configured
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
    async (message: string, context?: string) => {
      const userMessage: ChatMessage = {
        id: generateId(),
        role: "user",
        content: message,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setLoading(true);
      setError(null);

      try {
        const response = await invoke<string>("chat_with_ai", {
          message,
          context: context || null,
          model,
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
    [model]
  );

  // Summarize files
  const summarizeFiles = useCallback(
    async (paths: string[]): Promise<string> => {
      setLoading(true);
      setError(null);
      try {
        const result = await invoke<string>("summarize_files", {
          paths,
          model,
        });
        return result;
      } catch (e) {
        const err = `Summarization failed: ${e}`;
        setError(err);
        throw new Error(err);
      } finally {
        setLoading(false);
      }
    },
    [model]
  );

  // Generate study guide
  const generateStudyGuide = useCallback(
    async (paths: string[]): Promise<string> => {
      setLoading(true);
      setError(null);
      try {
        const result = await invoke<string>("generate_study_guide", {
          paths,
          model,
        });
        return result;
      } catch (e) {
        const err = `Study guide generation failed: ${e}`;
        setError(err);
        throw new Error(err);
      } finally {
        setLoading(false);
      }
    },
    [model]
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
    isConfigured,
    setModel,
    checkConfig,
    sendMessage,
    summarizeFiles,
    generateStudyGuide,
    clearChat,
  };
}
