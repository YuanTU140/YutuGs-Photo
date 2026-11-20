import type { EditorObject, Matrix, Point, VectorObject } from './model';

export type Bounds = { x: number; y: number; width: number; height: number; minX: number; minY: number; maxX: number; maxY: number };
const boundsFrom = (points: Point[]): Bounds | null => {
  if (!points.length) return null;
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const minX = Math.min(...xs), minY = Math.min(...ys), maxX = Math.max(...xs), maxY = Math.max(...ys);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY, minX, minY, maxX, maxY };
};
export function applyMatrix(p: Point, m: Matrix): Point {
  return { x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] };
}
export function multiplyMatrices(a: Matrix, b: Matrix): Matrix {
  return [a[0]*b[0]+a[2]*b[1], a[1]*b[0]+a[3]*b[1], a[0]*b[2]+a[2]*b[3], a[1]*b[2]+a[3]*b[3], a[0]*b[4]+a[2]*b[5]+a[4], a[1]*b[4]+a[3]*b[5]+a[5]];
}
export function invertMatrix(m: Matrix): Matrix {
  const det = m[0]*m[3]-m[1]*m[2];
  if (Math.abs(det) < 1e-12) throw new Error('Object transform is singular');
  return [m[3]/det, -m[1]/det, -m[2]/det, m[0]/det, (m[2]*m[5]-m[3]*m[4])/det, (m[1]*m[4]-m[0]*m[5])/det];
}
export function cubicPoint(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1-t, a=u*u*u, b=3*u*u*t, c=3*u*t*t, d=t*t*t;
  return { x:a*p0.x+b*p1.x+c*p2.x+d*p3.x, y:a*p0.y+b*p1.y+c*p2.y+d*p3.y };
}
function cubicExtrema(p0:number,p1:number,p2:number,p3:number):number[] {
  const a=-p0+3*p1-3*p2+p3, b=2*(p0-2*p1+p2), c=p1-p0;
  if (Math.abs(a)<1e-12) return Math.abs(b)<1e-12?[]:[-c/b].filter(t=>t>0&&t<1);
  const d=b*b-4*a*c;
  if (d<0) return [];
  const s=Math.sqrt(d); return [(-b+s)/(2*a),(-b-s)/(2*a)].filter(t=>t>0&&t<1);
}
function pathPoints(g: Extract<VectorObject['geometry'], {nodes: unknown[]}>, samples=16): Point[] {
  const out:Point[]=[];
  for (const segment of g.segments) {
    const end=g.nodes[segment.to]?.anchor; if(!end) continue;
    if(segment.type==='move'||segment.type==='line'){out.push(end);continue;}
    if(segment.type==='quadratic'&&segment.control){
      const start=out[out.length-1] ?? end;
      for(let i=1;i<=samples;i++){const t=i/samples,u=1-t;out.push({x:u*u*start.x+2*u*t*segment.control.x+t*t*end.x,y:u*u*start.y+2*u*t*segment.control.y+t*t*end.y});}
      continue;
    }
    if(segment.type==='cubic'&&segment.from!==undefined){
      const start=g.nodes[segment.from]?.anchor, n0=g.nodes[segment.from], n1=g.nodes[segment.to];
      if(!start) continue;
      const c1=n0.outHandle??start,c2=n1.inHandle??end;
      for(let i=1;i<=samples;i++) out.push(cubicPoint(start,c1,c2,end,i/samples));
    }
  }
  return out;
}
export function getLocalBounds(object: EditorObject): Bounds | null {
  if(object.kind==='image') return boundsFrom([{x:object.x,y:object.y},{x:object.x+object.width,y:object.y+object.height}]);
  const v=object as VectorObject;
  if(v.kind==='rect'||v.kind==='ellipse') { const g=v.geometry as {x:number;y:number;width:number;height:number}; return boundsFrom([{x:g.x,y:g.y},{x:g.x+g.width,y:g.y+g.height}]); }
  if(v.kind==='text') { const g=v.geometry as {x:number;y:number;text:string;fontSize:number}; return boundsFrom([{x:g.x,y:g.y-g.fontSize},{x:g.x+Math.max(g.fontSize*0.5,g.text.length*g.fontSize*0.6),y:g.y}]); }
  const g=v.geometry as Extract<VectorObject['geometry'], {nodes: unknown[]}>;
  const points=pathPoints(g);
  // Include Bézier extrema so bounds do not depend only on the sampling grid.
  for(const s of g.segments){ if(s.type!=='cubic'||s.from===undefined) continue; const n0=g.nodes[s.from],n1=g.nodes[s.to]; if(!n0||!n1) continue; const p0=n0.anchor,p1=n0.outHandle??p0,p2=n1.inHandle??n1.anchor,p3=n1.anchor;
    const ts=new Set([...cubicExtrema(p0.x,p1.x,p2.x,p3.x),...cubicExtrema(p0.y,p1.y,p2.y,p3.y)]);
    for(const t of ts) points.push(cubicPoint(p0,p1,p2,p3,t));
  }
  return boundsFrom(points);
}
export function getObjectBounds(object: EditorObject): Bounds | null {
  const b=getLocalBounds(object); if(!b)return null;
  return boundsFrom([{x:b.minX,y:b.minY},{x:b.maxX,y:b.minY},{x:b.maxX,y:b.maxY},{x:b.minX,y:b.maxY}].map(p=>applyMatrix(p,object.transform)));
}
export function unionBounds(items: Bounds[]): Bounds | null {
  if(!items.length)return null;
  const minX=Math.min(...items.map(b=>b.minX)),minY=Math.min(...items.map(b=>b.minY)),maxX=Math.max(...items.map(b=>b.maxX)),maxY=Math.max(...items.map(b=>b.maxY));
  return {x:minX,y:minY,width:maxX-minX,height:maxY-minY,minX,minY,maxX,maxY};
}
export type AlignAxis='left'|'center-x'|'right'|'top'|'center-y'|'bottom';
export function alignedTransform(object:EditorObject, target:Bounds, axis:AlignAxis):Matrix {
  const own=getObjectBounds(object); if(!own) return object.transform;
  const dx=axis==='left'?target.minX-own.minX:axis==='right'?target.maxX-own.maxX:axis==='center-x'?(target.minX+target.maxX-own.minX-own.maxX)/2:0;
  const dy=axis==='top'?target.minY-own.minY:axis==='bottom'?target.maxY-own.maxY:axis==='center-y'?(target.minY+target.maxY-own.minY-own.maxY)/2:0;
  return [object.transform[0],object.transform[1],object.transform[2],object.transform[3],object.transform[4]+dx,object.transform[5]+dy];
}
function distanceToSegment(p:Point,a:Point,b:Point):number { const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy; const t=l?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l)):0; return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy)); }
export function hitTestObject(object:EditorObject, point:Point, tolerance=5):boolean {
  if(!object.visible||object.locked)return false;
  let local:Point; try{local=applyMatrix(point,invertMatrix(object.transform));}catch{return false;}
  const b=getLocalBounds(object); if(!b||local.x<b.minX-tolerance||local.x>b.maxX+tolerance||local.y<b.minY-tolerance||local.y>b.maxY+tolerance)return false;
  if(object.kind==='image')return true;
  const v=object as VectorObject;
  if(v.kind==='rect'||v.kind==='text')return true;
  if(v.kind==='ellipse') {
    const g=v.geometry as {x:number;y:number;width:number;height:number};
    const rx=g.width/2, ry=g.height/2;
    if(rx<=0||ry<=0)return false;
    const nx=(local.x-(g.x+rx))/rx, ny=(local.y-(g.y+ry))/ry;
    return nx*nx+ny*ny<=1+(tolerance/Math.max(1,Math.min(rx,ry)));
  }
  const g=v.geometry as Extract<VectorObject['geometry'],{nodes:unknown[]}>;
  const pts=pathPoints(g,24); for(let i=1;i<pts.length;i++)if(distanceToSegment(local,pts[i-1],pts[i])<=tolerance)return true;
  if(g.closed&&pts.length>2&&distanceToSegment(local,pts[pts.length-1],pts[0])<=tolerance)return true;
  return false;
}
export function hitTest(objects:EditorObject[], point:Point, tolerance=5):EditorObject|null {
  for(let i=objects.length-1;i>=0;i--)if(hitTestObject(objects[i],point,tolerance))return objects[i];
  return null;
}
