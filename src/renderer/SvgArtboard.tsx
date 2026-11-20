import type { Artboard, EditorObject, VectorObject } from '../core/model';
import type { Viewport } from '../core/viewport';

type Props = { artboard: Artboard; objects: Record<string, EditorObject>; viewport: Viewport; previewTransforms?: Record<string, EditorObject['transform']>; selectionBounds?: { minX: number; minY: number; maxX: number; maxY: number } | null; marquee?: { x: number; y: number; width: number; height: number } | null };
function renderObject(object: EditorObject, previewTransform?: EditorObject['transform']) {
  if (object.kind === 'image') return null; // Raster assets are mounted by the asset renderer, not rasterized through Canvas 2D.
  const vector = object as VectorObject;
  const common = { transform: `matrix(${(previewTransform ?? object.transform).join(' ')})`, opacity: object.opacity, fill: vector.fill ?? 'none', stroke: vector.stroke ?? 'none', strokeWidth: vector.strokeWidth };
  let shape;
  if (vector.kind === 'rect') {
    const g = vector.geometry as { x: number; y: number; width: number; height: number };
    shape = <rect x={g.x} y={g.y} width={g.width} height={g.height} {...common} />;
  } else if (vector.kind === 'ellipse') {
    const g = vector.geometry as { x: number; y: number; width: number; height: number };
    shape = <ellipse cx={g.x + g.width / 2} cy={g.y + g.height / 2} rx={g.width / 2} ry={g.height / 2} {...common} />;
  } else if (vector.kind === 'text') {
    const g = vector.geometry as { x: number; y: number; text: string; fontSize: number; fontFamily: string };
    shape = <text x={g.x} y={g.y} fontSize={g.fontSize} fontFamily={g.fontFamily} {...common}>{g.text}</text>;
  } else {
    // Path serialization uses SVG path data.
    const g = vector.geometry as { nodes: { anchor: {x:number;y:number}; inHandle: {x:number;y:number}|null; outHandle: {x:number;y:number}|null; }[]; segments: {type:string;to:number;from?:number;control?:{x:number;y:number}}[]; closed:boolean };
    const d = g.segments.map((segment, i) => {
      const target = g.nodes[segment.to]?.anchor;
      if (!target) return '';
      if (segment.type === 'move') return `${i ? ' ' : ''}M ${target.x} ${target.y}`;
      if (segment.type === 'line') return `L ${target.x} ${target.y}`;
      if (segment.type === 'quadratic' && segment.control) return `Q ${segment.control.x} ${segment.control.y} ${target.x} ${target.y}`;
      if (segment.type === 'cubic' && segment.from !== undefined) {
        const from = g.nodes[segment.from];
        const c1 = from?.outHandle ?? from?.anchor;
        const c2 = g.nodes[segment.to]?.inHandle ?? target;
        return `C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${target.x} ${target.y}`;
      }
      return '';
    }).join(' ') + (g.closed ? ' Z' : '');
    shape = <path d={d} {...common} />;
  }
  return <g key={object.id}>{shape}</g>;
}
export default function SvgArtboard({ artboard, objects, viewport, previewTransforms = {}, selectionBounds, marquee }: Props) {
  return <svg className="artboard-svg" width={artboard.width * viewport.zoom} height={artboard.height * viewport.zoom}
    viewBox={`0 0 ${artboard.width} ${artboard.height}`} style={{ left: viewport.panX, top: viewport.panY, background: artboard.background === 'transparent' ? 'transparent' : artboard.background }}>
    {artboard.layerIds.flatMap((layerId) => Object.values(objects).filter((object) => object.layerId === layerId && object.visible).map((object) => renderObject(object, previewTransforms[object.id])))}
    {selectionBounds && <g className="selection-overlay" pointerEvents="none"><rect x={selectionBounds.minX} y={selectionBounds.minY} width={selectionBounds.maxX-selectionBounds.minX} height={selectionBounds.maxY-selectionBounds.minY} fill="none" stroke="#4c9ffe" strokeWidth={1.5/viewport.zoom} strokeDasharray={`${5/viewport.zoom} ${3/viewport.zoom}`} />{([{x:selectionBounds.minX,y:selectionBounds.minY},{x:(selectionBounds.minX+selectionBounds.maxX)/2,y:selectionBounds.minY},{x:selectionBounds.maxX,y:selectionBounds.minY},{x:selectionBounds.maxX,y:(selectionBounds.minY+selectionBounds.maxY)/2},{x:selectionBounds.maxX,y:selectionBounds.maxY},{x:(selectionBounds.minX+selectionBounds.maxX)/2,y:selectionBounds.maxY},{x:selectionBounds.minX,y:selectionBounds.maxY},{x:selectionBounds.minX,y:(selectionBounds.minY+selectionBounds.maxY)/2}] as const).map((p,i)=><rect key={i} x={p.x-4/viewport.zoom} y={p.y-4/viewport.zoom} width={8/viewport.zoom} height={8/viewport.zoom} fill="#fff" stroke="#2687ef" strokeWidth={1.5/viewport.zoom}/>)}<path d={`M ${(selectionBounds.minX+selectionBounds.maxX)/2} ${selectionBounds.minY} v ${-28/viewport.zoom}`} stroke="#2687ef" strokeWidth={1/viewport.zoom}/><circle cx={(selectionBounds.minX+selectionBounds.maxX)/2} cy={selectionBounds.minY-36/viewport.zoom} r={5/viewport.zoom} fill="#fff" stroke="#2687ef" strokeWidth={1.5/viewport.zoom}/></g>}
    {marquee && <rect x={marquee.x} y={marquee.y} width={marquee.width} height={marquee.height} fill="#4c9ffe" fillOpacity=".12" stroke="#4c9ffe" strokeDasharray="5 3" pointerEvents="none"/>}
  </svg>;
}
