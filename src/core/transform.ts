import type { Matrix, Point } from './model';
import type { Bounds } from './geometry';
import { multiplyMatrices } from './geometry';

export type TransformHandle = 'nw'|'n'|'ne'|'e'|'se'|'s'|'sw'|'w'|'rotate';
export type InteractiveTransform = 'move'|'resize'|'rotate';

/** Build a world-space group transform from the pointer gesture's original snapshot. */
export function createInteractiveTransform(
  matrix: Matrix,
  kind: InteractiveTransform,
  start: Point,
  current: Point,
  bounds: Bounds | null,
  handle?: TransformHandle,
): Matrix {
  if (kind === 'move') return multiplyMatrices([1,0,0,1,current.x-start.x,current.y-start.y], matrix);
  if (!bounds) return matrix;
  if (kind === 'rotate') {
    const cx=(bounds.minX+bounds.maxX)/2, cy=(bounds.minY+bounds.maxY)/2;
    const angle=Math.atan2(current.y-cy,current.x-cx)-Math.atan2(start.y-cy,start.x-cx);
    const c=Math.cos(angle), s=Math.sin(angle);
    return multiplyMatrices([c,s,-s,c,cx-c*cx+s*cy,cy-s*cx-c*cy],matrix);
  }
  const left=handle?.includes('w') ?? false, right=handle?.includes('e') ?? false;
  const top=handle==='nw'||handle==='n'||handle==='ne', bottom=handle==='sw'||handle==='s'||handle==='se';
  const anchorX=left?bounds.maxX:right?bounds.minX:(bounds.minX+bounds.maxX)/2;
  const anchorY=top?bounds.maxY:bottom?bounds.minY:(bounds.minY+bounds.maxY)/2;
  const startX=left||right?(left?bounds.minX:bounds.maxX):start.x;
  const startY=top||bottom?(top?bounds.minY:bounds.maxY):start.y;
  const sx=left||right?Math.max(0.02,Math.abs(current.x-anchorX)/Math.max(1,Math.abs(startX-anchorX))):1;
  const sy=top||bottom?Math.max(0.02,Math.abs(current.y-anchorY)/Math.max(1,Math.abs(startY-anchorY))):1;
  const signedX=left&&current.x>anchorX?-sx:left&&current.x<=anchorX?sx:right&&current.x<anchorX?-sx:sx;
  const signedY=top&&current.y>anchorY?-sy:top&&current.y<=anchorY?sy:bottom&&current.y<anchorY?-sy:sy;
  return multiplyMatrices([signedX,0,0,signedY,anchorX*(1-signedX),anchorY*(1-signedY)],matrix);
}
