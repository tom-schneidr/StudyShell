const MIME_EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
};

export function extensionFromImageMimeType(mimeType: string): string {
  const normalized = mimeType.trim().toLowerCase();
  if (!normalized) {
    return "png";
  }

  if (MIME_EXTENSION_MAP[normalized]) {
    return MIME_EXTENSION_MAP[normalized];
  }

  const subtype = normalized.split("/")[1];
  if (!subtype) {
    return "png";
  }

  return subtype.split("+")[0] || "png";
}

export function buildPastedImageFilename(mimeType: string, timestamp = Date.now()): string {
  return `pasted-image-${timestamp}.${extensionFromImageMimeType(mimeType)}`;
}

export function buildMarkdownImageTag(filename: string, relativePath: string): string {
  return `\n![${filename}](${relativePath})\n`;
}

export function insertTextAtSelection(
  content: string,
  start: number,
  end: number,
  insertion: string,
): string {
  const safeStart = Math.max(0, Math.min(start, content.length));
  const safeEnd = Math.max(safeStart, Math.min(end, content.length));
  return `${content.slice(0, safeStart)}${insertion}${content.slice(safeEnd)}`;
}
