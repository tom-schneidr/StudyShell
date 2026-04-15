import type {
  HighlightRect,
  InkPath,
  PdfAnnotationData,
  StickyNote,
  Textbox,
} from "../types";

export function buildPdfAnnotationSidecarPath(pdfPath: string): string {
  return `${pdfPath}.annotations.json`;
}

export function createEmptyPdfAnnotationData(): PdfAnnotationData {
  return {
    version: 1,
    pages: {},
  };
}

export function serializePdfAnnotationData(data: PdfAnnotationData): string {
  return JSON.stringify(data, null, 2);
}

export function parsePdfAnnotationData(raw: string): PdfAnnotationData | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const version = parsed.version;
    const pages = parsed.pages;

    if (typeof version !== "number" || !pages || typeof pages !== "object") {
      return null;
    }

    const normalizedPages: PdfAnnotationData["pages"] = {};

    for (const [pageKey, pageValue] of Object.entries(pages)) {
      const pageNumber = Number(pageKey);
      if (!Number.isInteger(pageNumber) || pageNumber < 1) {
        return null;
      }

      if (!pageValue || typeof pageValue !== "object") {
        return null;
      }

      const ink = normalizeInkPaths((pageValue as Record<string, unknown>).ink);
      const highlights = normalizeHighlightRects((pageValue as Record<string, unknown>).highlights);
      const notes = normalizeStickyNotes((pageValue as Record<string, unknown>).notes);
      const textboxes = normalizeTextboxes((pageValue as Record<string, unknown>).textboxes);

      if (!ink || !highlights || !notes || !textboxes) {
        return null;
      }

      normalizedPages[pageNumber] = {
        ink,
        highlights,
        notes,
        textboxes,
      };
    }

    return {
      version,
      pages: normalizedPages,
    };
  } catch {
    return null;
  }
}

function normalizeInkPaths(value: unknown): InkPath[] | null {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    return null;
  }

  return value.map((entry) => {
    if (!entry || typeof entry !== "object") {
      throw new Error("Invalid ink path");
    }

    const record = entry as Record<string, unknown>;
    if (
      typeof record.id !== "string" ||
      typeof record.color !== "string" ||
      typeof record.width !== "number" ||
      !Array.isArray(record.points)
    ) {
      throw new Error("Invalid ink path");
    }

    const points = record.points.map((point) => {
      if (!point || typeof point !== "object") {
        throw new Error("Invalid ink point");
      }

      const pointRecord = point as Record<string, unknown>;
      if (typeof pointRecord.x !== "number" || typeof pointRecord.y !== "number") {
        throw new Error("Invalid ink point");
      }

      return {
        x: pointRecord.x,
        y: pointRecord.y,
      };
    });

    return {
      id: record.id,
      color: record.color,
      width: record.width,
      points,
    };
  });
}

function normalizeHighlightRects(value: unknown): HighlightRect[] | null {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    return null;
  }

  return value.map((entry) => {
    if (!entry || typeof entry !== "object") {
      throw new Error("Invalid highlight");
    }

    const record = entry as Record<string, unknown>;
    if (
      typeof record.id !== "string" ||
      typeof record.x !== "number" ||
      typeof record.y !== "number" ||
      typeof record.width !== "number" ||
      typeof record.height !== "number" ||
      typeof record.color !== "string"
    ) {
      throw new Error("Invalid highlight");
    }

    return {
      id: record.id,
      x: record.x,
      y: record.y,
      width: record.width,
      height: record.height,
      color: record.color,
    };
  });
}

function normalizeStickyNotes(value: unknown): StickyNote[] | null {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    return null;
  }

  return value.map((entry) => {
    if (!entry || typeof entry !== "object") {
      throw new Error("Invalid sticky note");
    }

    const record = entry as Record<string, unknown>;
    if (
      typeof record.id !== "string" ||
      typeof record.x !== "number" ||
      typeof record.y !== "number" ||
      typeof record.content !== "string" ||
      typeof record.author !== "string"
    ) {
      throw new Error("Invalid sticky note");
    }

    return {
      id: record.id,
      x: record.x,
      y: record.y,
      content: record.content,
      author: record.author,
    };
  });
}

function normalizeTextboxes(value: unknown): Textbox[] | null {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    return null;
  }

  return value.map((entry) => {
    if (!entry || typeof entry !== "object") {
      throw new Error("Invalid textbox");
    }

    const record = entry as Record<string, unknown>;
    if (
      typeof record.id !== "string" ||
      typeof record.x !== "number" ||
      typeof record.y !== "number" ||
      typeof record.width !== "number" ||
      typeof record.height !== "number" ||
      typeof record.content !== "string" ||
      typeof record.color !== "string" ||
      typeof record.fontSize !== "number"
    ) {
      throw new Error("Invalid textbox");
    }

    return {
      id: record.id,
      x: record.x,
      y: record.y,
      width: record.width,
      height: record.height,
      content: record.content,
      color: record.color,
      fontSize: record.fontSize,
    };
  });
}
