import { useEffect, useState } from "react";
import { STORAGE_KEYS, parseStoredBoolean, parseStoredRootPath } from "../utils/appPreferences";

export function useSplitViewState(storage: Storage = window.localStorage) {
  const [isSplit, setIsSplit] = useState(() =>
    parseStoredBoolean(storage.getItem(STORAGE_KEYS.splitViewEnabled), false),
  );
  const [restoredSecondPanePath, setRestoredSecondPanePath] = useState<string | null>(() =>
    parseStoredRootPath(storage.getItem(STORAGE_KEYS.splitViewPath)),
  );

  useEffect(() => {
    storage.setItem(STORAGE_KEYS.splitViewEnabled, String(isSplit));
  }, [isSplit, storage]);

  const persistSecondPanePath = (path: string | null) => {
    if (path) {
      storage.setItem(STORAGE_KEYS.splitViewPath, path);
      return;
    }

    storage.removeItem(STORAGE_KEYS.splitViewPath);
  };

  return {
    isSplit,
    setIsSplit,
    restoredSecondPanePath,
    setRestoredSecondPanePath,
    persistSecondPanePath,
  };
}
