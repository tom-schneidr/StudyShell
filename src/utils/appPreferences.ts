import type { VertexModel } from "../types.ts";

export const APP_VERSION = "0.2.1";
export const DEFAULT_VERTEX_MODEL: VertexModel = "gemini-3-flash-preview";
export const DEFAULT_USE_SEARCH = false;
export const DEFAULT_SYSTEM_PROMPT =
  "You are StudyShell AI, a professional academic assistant. Support markdown in all responses.";

export const STORAGE_KEYS = {
  chatHistory: "studyshell.chatHistory",
  chatPanelVisible: "studyshell.chatPanelVisible",
  chatWidth: "studyshell.chatWidth",
  rootPath: "studyshell.rootPath",
  sidebarWidth: "studyshell.sidebarWidth",
  splitViewEnabled: "studyshell.splitViewEnabled",
  splitViewPath: "studyshell.splitViewPath",
  studyTimer: "studyshell.studyTimer",
  systemPrompt: "studyshell.systemPrompt",
  theme: "studyshell.theme",
  vertexModel: "studyshell.vertexModel",
  useSearch: "studyshell.useSearch",
} as const;

const VALID_MODELS = new Set<VertexModel>([
  "gemini-3.1-pro-preview",
  "gemini-3-flash-preview",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
]);

export function parseStoredVertexModel<TFallback extends VertexModel | undefined = VertexModel>(
  raw: string | null | undefined,
  fallback: TFallback = DEFAULT_VERTEX_MODEL as TFallback,
): VertexModel | TFallback {
  if (!raw) {
    return fallback;
  }

  return VALID_MODELS.has(raw as VertexModel) ? (raw as VertexModel) : fallback;
}

export function parseStoredBoolean(raw: string | null | undefined, fallback: boolean): boolean {
  if (raw === "true") {
    return true;
  }

  if (raw === "false") {
    return false;
  }

  return fallback;
}

export function parseStoredString(raw: string | null | undefined, fallback: string): string {
  if (typeof raw !== "string") {
    return fallback;
  }

  const normalized = raw.trim();
  return normalized.length > 0 ? normalized : fallback;
}

export function parseStoredRootPath(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") {
    return null;
  }

  const normalized = raw.trim();
  return normalized.length > 0 ? normalized : null;
}

export function parseStoredNumber(raw: string | null | undefined, fallback: number): number {
  if (typeof raw !== "string") {
    return fallback;
  }

  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}
