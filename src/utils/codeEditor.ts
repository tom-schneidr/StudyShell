import { getPathExtension } from "./pathUtils.ts";

export function resolveCodeLanguage(language?: string, path?: string): string | undefined {
  if (language) {
    return language.toLowerCase();
  }

  if (!path) {
    return undefined;
  }

  const extension = getPathExtension(path)?.toLowerCase();
  if (extension) {
    return extension;
  }

  const normalizedPath = path.replace(/[/\\]+$/, "");
  if (normalizedPath.toLowerCase().endsWith("makefile")) {
    return "makefile";
  }

  return undefined;
}

export function shouldPersistCodeContent(nextContent: string, lastSavedContent: string): boolean {
  return nextContent !== lastSavedContent;
}
