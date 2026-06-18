import { useEffect, useState } from "react";
import { STORAGE_KEYS } from "../utils/appPreferences";

export type ShellTheme = "dark" | "light";

export function useThemePreference(storage: Storage = window.localStorage) {
  const [theme, setTheme] = useState<ShellTheme>(() => {
    const storedTheme = storage.getItem(STORAGE_KEYS.theme) ?? storage.getItem("theme");
    return storedTheme === "light" ? "light" : "dark";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "light") {
      root.classList.add("theme-light");
    } else {
      root.classList.remove("theme-light");
    }

    storage.setItem(STORAGE_KEYS.theme, theme);
  }, [storage, theme]);

  return { theme, setTheme };
}
