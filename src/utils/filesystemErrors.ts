export function formatFilesystemError(error: string | null): string | null {
  if (!error) {
    return null;
  }

  const normalized = error.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return null;
  }

  return normalized.endsWith(".") ? normalized : `${normalized}.`;
}
