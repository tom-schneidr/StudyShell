import type { ChatMessage, VertexModel } from "../types.ts";

export const CHAT_HISTORY_LIMIT = 200;

const VALID_MODELS = new Set<VertexModel>([
  "gemini-3.1-pro-preview",
  "gemini-3-flash-preview",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
]);

interface StoredChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  model?: VertexModel;
}

export function limitChatHistory(messages: ChatMessage[], limit = CHAT_HISTORY_LIMIT): ChatMessage[] {
  return messages.slice(-limit);
}

export function serializeChatHistory(messages: ChatMessage[]): string {
  const storedMessages: StoredChatMessage[] = limitChatHistory(messages).map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    timestamp: message.timestamp.toISOString(),
    ...(message.model ? { model: message.model } : {}),
  }));

  return JSON.stringify(storedMessages);
}

export function deserializeChatHistory(raw: string): ChatMessage[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  const messages: ChatMessage[] = [];

  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const id = typeof entry.id === "string" ? entry.id : null;
    const role = entry.role === "user" || entry.role === "assistant" ? entry.role : null;
    const content = typeof entry.content === "string" ? entry.content : null;
    const timestampValue = typeof entry.timestamp === "string" ? entry.timestamp : null;
    const timestamp = timestampValue ? new Date(timestampValue) : null;

    if (!id || !role || !content || !timestamp || Number.isNaN(timestamp.getTime())) {
      continue;
    }

    const model =
      typeof entry.model === "string" && VALID_MODELS.has(entry.model as VertexModel)
        ? (entry.model as VertexModel)
        : undefined;

    messages.push({
      id,
      role,
      content,
      timestamp,
      ...(model ? { model } : {}),
    });
  }

  return limitChatHistory(messages);
}
