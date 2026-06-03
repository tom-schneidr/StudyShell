export { FREEROUTER_MODEL } from "./freerouter.ts";

export const APP_VERSION = "0.2.1";
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
  useSearch: "studyshell.useSearch",
} as const;

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
