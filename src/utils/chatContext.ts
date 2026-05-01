import { getFileType } from "../types.ts";
import type { FileNode } from "../types.ts";

export interface ChatContextSection {
  label: string;
  path: string;
  content: string;
}

const CHAT_CONTEXT_SUFFIX = "\n\n[Truncated for AI context]";
const MAX_SECTION_CHARS = 8_000;
const MAX_CONTEXT_CHARS = 24_000;

export function canUseFileAsChatContext(node: Pick<FileNode, "extension">): boolean {
  const fileType = getFileType(node.extension);
  return fileType === "markdown" || fileType === "text" || fileType === "notebook";
}

export function truncateChatContextContent(content: string, maxChars: number): string {
  const normalized = content.trim();
  if (normalized.length <= maxChars) {
    return normalized;
  }

  if (maxChars <= CHAT_CONTEXT_SUFFIX.length) {
    return normalized.slice(0, maxChars);
  }

  return `${normalized.slice(0, maxChars - CHAT_CONTEXT_SUFFIX.length).trimEnd()}${CHAT_CONTEXT_SUFFIX}`;
}

export function buildChatContext(sections: ChatContextSection[]): string | undefined {
  const renderedSections: string[] = [];
  let remainingChars = MAX_CONTEXT_CHARS;
  const seenPaths = new Set<string>();

  for (const section of sections) {
    const normalized = section.content.trim();
    if (!normalized || seenPaths.has(section.path)) {
      continue;
    }

    seenPaths.add(section.path);

    const header = `${section.label}\nPath: ${section.path}\n---\n`;
    const footer = "\n---";
    const chromeLength = header.length + footer.length;

    if (chromeLength >= remainingChars) {
      break;
    }

    const availableChars = Math.min(MAX_SECTION_CHARS, remainingChars - chromeLength);
    const content = truncateChatContextContent(normalized, availableChars);

    renderedSections.push(`${header}${content}${footer}`);
    remainingChars -= chromeLength + content.length + 2;
  }

  if (!renderedSections.length) {
    return undefined;
  }

  return renderedSections.join("\n\n");
}
