import { useEffect, useState } from "react";
import { STORAGE_KEYS } from "../utils/appPreferences";
import {
  readStoredChatPanelVisible,
  readStoredChatWidth,
  readStoredSidebarWidth,
  clampChatWidth,
  clampSidebarWidth,
} from "../utils/layoutPreferences";

export function useShellLayoutState(storage: Storage = window.localStorage) {
  const [showChatPanel, setShowChatPanel] = useState(() => readStoredChatPanelVisible(storage));
  const [sidebarWidth, setSidebarWidth] = useState(() => readStoredSidebarWidth(storage));
  const [chatWidth, setChatWidth] = useState(() => readStoredChatWidth(storage));

  useEffect(() => {
    storage.setItem(STORAGE_KEYS.sidebarWidth, String(clampSidebarWidth(sidebarWidth)));
  }, [sidebarWidth, storage]);

  useEffect(() => {
    storage.setItem(STORAGE_KEYS.chatWidth, String(clampChatWidth(chatWidth)));
  }, [chatWidth, storage]);

  useEffect(() => {
    storage.setItem(STORAGE_KEYS.chatPanelVisible, String(showChatPanel));
  }, [showChatPanel, storage]);

  return {
    showChatPanel,
    setShowChatPanel,
    sidebarWidth,
    setSidebarWidth,
    chatWidth,
    setChatWidth,
  };
}
