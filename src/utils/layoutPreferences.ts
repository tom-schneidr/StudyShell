import { STORAGE_KEYS, parseStoredBoolean, parseStoredNumber } from "./appPreferences.ts";

export const DEFAULT_SIDEBAR_WIDTH = 280;
export const DEFAULT_CHAT_WIDTH = 400;
export const MIN_SIDEBAR_WIDTH = 150;
export const MAX_SIDEBAR_WIDTH = 600;
export const MIN_CHAT_WIDTH = 250;
export const MAX_CHAT_WIDTH = 800;

export function clampSidebarWidth(width: number): number {
  if (!Number.isFinite(width)) {
    return DEFAULT_SIDEBAR_WIDTH;
  }

  if (width <= 0) {
    return 0;
  }

  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, Math.round(width)));
}

export function clampChatWidth(width: number): number {
  if (!Number.isFinite(width)) {
    return DEFAULT_CHAT_WIDTH;
  }

  return Math.min(MAX_CHAT_WIDTH, Math.max(MIN_CHAT_WIDTH, Math.round(width)));
}

export function readStoredSidebarWidth(storage: Pick<Storage, "getItem">): number {
  return clampSidebarWidth(
    parseStoredNumber(storage.getItem(STORAGE_KEYS.sidebarWidth), DEFAULT_SIDEBAR_WIDTH),
  );
}

export function readStoredChatWidth(storage: Pick<Storage, "getItem">): number {
  return clampChatWidth(
    parseStoredNumber(storage.getItem(STORAGE_KEYS.chatWidth), DEFAULT_CHAT_WIDTH),
  );
}

export function readStoredChatPanelVisible(storage: Pick<Storage, "getItem">): boolean {
  return parseStoredBoolean(storage.getItem(STORAGE_KEYS.chatPanelVisible), true);
}
