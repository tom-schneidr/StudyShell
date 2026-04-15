export function resolveCodeLanguage(language?: string, path?: string): string | undefined {
  if (language) {
    return language.toLowerCase();
  }

  const extension = path?.split(".").pop()?.toLowerCase();
  return extension || undefined;
}

export function shouldPersistCodeContent(nextContent: string, lastSavedContent: string): boolean {
  return nextContent !== lastSavedContent;
}
