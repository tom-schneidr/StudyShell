export const DEFAULT_PDF_SCALE = 0.8;
export const MIN_PDF_SCALE = 0.4;
export const MAX_PDF_SCALE = 3;
export const PDF_SCALE_STEP = 0.2;

export function clampPdfScale(scale: number): number {
  if (!Number.isFinite(scale)) {
    return DEFAULT_PDF_SCALE;
  }

  return Math.min(Math.max(scale, MIN_PDF_SCALE), MAX_PDF_SCALE);
}

export function getNextPdfScale(currentScale: number, direction: 1 | -1): number {
  return clampPdfScale(currentScale + direction * PDF_SCALE_STEP);
}

export function clampPdfPageNumber(pageNumber: number, totalPages: number): number {
  if (!Number.isFinite(totalPages) || totalPages <= 0) {
    return 1;
  }

  if (!Number.isFinite(pageNumber)) {
    return 1;
  }

  return Math.min(Math.max(Math.trunc(pageNumber), 1), totalPages);
}

export function getNextPdfPageNumber(
  currentPage: number,
  totalPages: number,
  direction: 1 | -1,
): number {
  return clampPdfPageNumber(currentPage + direction, totalPages);
}

export function parsePdfPageNumberInput(
  value: string,
  totalPages: number,
  fallbackPage: number,
): number {
  const trimmed = value.trim();
  if (!trimmed) {
    return clampPdfPageNumber(fallbackPage, totalPages);
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed)) {
    return clampPdfPageNumber(fallbackPage, totalPages);
  }

  return clampPdfPageNumber(parsed, totalPages);
}
