export interface MarkdownHeading {
  id: string;
  level: number;
  line: number;
  text: string;
}

function slugifyHeading(text: string): string {
  const normalized = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "section";
}

function stripTrailingHeadingHashes(text: string): string {
  return text.replace(/\s+#+\s*$/, "").trim();
}

export function parseMarkdownHeadings(content: string): MarkdownHeading[] {
  const lines = content.split(/\r?\n/);
  const headings: MarkdownHeading[] = [];
  const slugCounts = new Map<string, number>();
  let activeFence: "`" | "~" | null = null;

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (/^`{3,}/.test(trimmed)) {
      activeFence = activeFence === "`" ? null : "`";
      return;
    }

    if (/^~{3,}/.test(trimmed)) {
      activeFence = activeFence === "~" ? null : "~";
      return;
    }

    if (activeFence) {
      return;
    }

    const match = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (!match) {
      return;
    }

    const text = stripTrailingHeadingHashes(match[2]);
    if (!text) {
      return;
    }

    const baseSlug = slugifyHeading(text);
    const slugCount = (slugCounts.get(baseSlug) ?? 0) + 1;
    slugCounts.set(baseSlug, slugCount);

    headings.push({
      id: slugCount === 1 ? baseSlug : `${baseSlug}-${slugCount}`,
      level: match[1].length,
      line: index + 1,
      text,
    });
  });

  return headings;
}

export function getMarkdownHeadingOffset(content: string, lineNumber: number): number {
  if (lineNumber <= 1) {
    return 0;
  }

  let offset = 0;
  let currentLine = 1;

  while (currentLine < lineNumber && offset < content.length) {
    const nextLineBreakIndex = content.indexOf("\n", offset);
    if (nextLineBreakIndex === -1) {
      return content.length;
    }

    offset = nextLineBreakIndex + 1;
    currentLine += 1;
  }

  return offset;
}
