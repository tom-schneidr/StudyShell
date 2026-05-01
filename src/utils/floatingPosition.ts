export interface FloatingMenuSize {
  width: number;
  height: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export function clampFloatingPosition(
  point: Point,
  menu: FloatingMenuSize,
  viewport: ViewportSize,
  margin = 12,
): Point {
  const maxX = Math.max(margin, viewport.width - menu.width - margin);
  const maxY = Math.max(margin, viewport.height - menu.height - margin);

  return {
    x: Math.min(Math.max(point.x, margin), maxX),
    y: Math.min(Math.max(point.y, margin), maxY),
  };
}
