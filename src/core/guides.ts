import type { Guide } from './model';
import type { Point } from './model';

/** Snap document-space coordinates to visible, unlocked guides within tolerance. */
export function snapPointToGuides(point: Point, guides: Guide[], tolerance = 6): { point: Point; snappedX: boolean; snappedY: boolean } {
  let x = point.x, y = point.y, snappedX = false, snappedY = false;
  const vertical = guides.filter(guide => guide.axis === 'x' && guide.visible !== false && !guide.locked);
  const horizontal = guides.filter(guide => guide.axis === 'y' && guide.visible !== false && !guide.locked);
  const nearestX = vertical.map(guide => guide.position).filter(position => Math.abs(position - x) <= tolerance).sort((a,b) => Math.abs(a-x)-Math.abs(b-x))[0];
  const nearestY = horizontal.map(guide => guide.position).filter(position => Math.abs(position - y) <= tolerance).sort((a,b) => Math.abs(a-y)-Math.abs(b-y))[0];
  if (nearestX !== undefined) { x = nearestX; snappedX = true; }
  if (nearestY !== undefined) { y = nearestY; snappedY = true; }
  return { point: { x, y }, snappedX, snappedY };
}
