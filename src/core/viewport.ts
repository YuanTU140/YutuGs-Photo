import type { Point } from './model';
export type Viewport = { panX: number; panY: number; zoom: number };
export const defaultViewport = (): Viewport => ({ panX: 0, panY: 0, zoom: 0.5 });
export function documentToScreen(point: Point, viewport: Viewport): Point {
  return { x: point.x * viewport.zoom + viewport.panX, y: point.y * viewport.zoom + viewport.panY };
}
export function screenToDocument(point: Point, viewport: Viewport): Point {
  return { x: (point.x - viewport.panX) / viewport.zoom, y: (point.y - viewport.panY) / viewport.zoom };
}
export function zoomAt(viewport: Viewport, screenPoint: Point, nextZoom: number): Viewport {
  const zoom = Math.min(8, Math.max(0.05, nextZoom));
  const anchor = screenToDocument(screenPoint, viewport);
  return { zoom, panX: screenPoint.x - anchor.x * zoom, panY: screenPoint.y - anchor.y * zoom };
}

/** Translate the viewport in screen-space pixels without changing document coordinates. */
export function panBy(viewport: Viewport, delta: Point): Viewport {
  return { ...viewport, panX: viewport.panX + delta.x, panY: viewport.panY + delta.y };
}
