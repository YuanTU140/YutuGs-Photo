import type { Point, VectorPath, VectorObject } from './model';
import { applyMatrix } from './geometry';

const EPS = 1e-7;
function cross(a: Point, b: Point, p: Point) { return (b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x); }
function area(poly: Point[]) { return poly.reduce((s,p,i)=>{const q=poly[(i+1)%poly.length];return s+p.x*q.y-q.x*p.y;},0)/2; }
function clean(poly: Point[]) { const out:Point[]=[]; for(const p of poly) if(!out.length||Math.hypot(p.x-out[out.length-1].x,p.y-out[out.length-1].y)>EPS)out.push(p); if(out.length>2&&Math.hypot(out[0].x-out.at(-1)!.x,out[0].y-out.at(-1)!.y)<EPS)out.pop(); return out; }
function lineIntersection(s:Point,e:Point,a:Point,b:Point):Point { const dx=e.x-s.x,dy=e.y-s.y, ex=b.x-a.x,ey=b.y-a.y, den=dx*ey-dy*ex; if(Math.abs(den)<EPS)return e; const t=((a.x-s.x)*ey-(a.y-s.y)*ex)/den; return {x:s.x+t*dx,y:s.y+t*dy}; }
function clipHalf(poly:Point[],a:Point,b:Point,inside:boolean) { const out:Point[]=[]; for(let i=0;i<poly.length;i++){const s=poly[i],e=poly[(i+1)%poly.length], si=cross(a,b,s),ei=cross(a,b,e), sin=inside?si>=-EPS:si<=EPS, ein=inside?ei>=-EPS:ei<=EPS; if(sin&&ein)out.push(e); else if(sin&&!ein)out.push(lineIntersection(s,e,a,b)); else if(!sin&&ein){out.push(lineIntersection(s,e,a,b));out.push(e);} } return clean(out); }
function orient(poly:Point[]) { return area(poly)>=0?poly:[...poly].reverse(); }
function clipConvex(subject:Point[],clip:Point[]) { let out=orient(subject); const c=orient(clip); for(let i=0;i<c.length&&out.length;i++)out=clipHalf(out,c[i],c[(i+1)%c.length],true); return out; }
function differenceConvex(subject:Point[],clip:Point[]) { let remaining=orient(subject); const c=orient(clip),pieces:Point[][]=[]; for(let i=0;i<c.length&&remaining.length;i++){const outside=clipHalf(remaining,c[i],c[(i+1)%c.length],false);if(outside.length>=3&&Math.abs(area(outside))>EPS)pieces.push(outside);remaining=clipHalf(remaining,c[i],c[(i+1)%c.length],true);} return pieces; }
function isConvex(poly:Point[]) { let sign=0; for(let i=0;i<poly.length;i++){const v=cross(poly[i],poly[(i+1)%poly.length],poly[(i+2)%poly.length]);if(Math.abs(v)<EPS)continue;const next=Math.sign(v);if(sign&&next!==sign)return false;sign=next;} return true; }
export function objectPolygon(object:VectorObject):Point[] {
 const g=object.geometry as any;
 if(object.kind==='rect'){const pts=[{x:g.x,y:g.y},{x:g.x+g.width,y:g.y},{x:g.x+g.width,y:g.y+g.height},{x:g.x,y:g.y+g.height}];return clean(pts.map(point=>applyMatrix(point,object.transform)));}
 if(object.kind==='ellipse'){const pts=Array.from({length:64},(_,i)=>({x:g.x+g.width/2+Math.cos(i*Math.PI/32)*g.width/2,y:g.y+g.height/2+Math.sin(i*Math.PI/32)*g.height/2}));return clean(pts.map(point=>applyMatrix(point,object.transform)));}
 if(object.kind!=='path'||!g.closed)throw new Error('路径布尔运算仅支持闭合矢量路径、矩形和椭圆');
 const pts:Point[]=[]; for(const seg of g.segments){const end=g.nodes[seg.to]?.anchor;if(!end)continue;if(seg.type==='move'||seg.type==='line')pts.push(end);else if(seg.type==='quadratic'&&seg.control){const start=pts.at(-1)??end;for(let i=1;i<=16;i++){const t=i/16,u=1-t;pts.push({x:u*u*start.x+2*u*t*seg.control.x+t*t*end.x,y:u*u*start.y+2*u*t*seg.control.y+t*t*end.y});}}else if(seg.type==='cubic'&&seg.from!==undefined){const n0=g.nodes[seg.from],start=n0.anchor,c1=n0.outHandle??start,c2=g.nodes[seg.to].inHandle??end;for(let i=1;i<=24;i++){const t=i/24,u=1-t;pts.push({x:u*u*u*start.x+3*u*u*t*c1.x+3*u*t*t*c2.x+t*t*t*end.x,y:u*u*u*start.y+3*u*u*t*c1.y+3*u*t*t*c2.y+t*t*t*end.y});}} }
 return clean(pts.map(point=>applyMatrix(point,object.transform)));
}
function toPath(polys:Point[][]):VectorPath { const nodes:VectorPath['nodes']=[],segments:VectorPath['segments']=[];for(const raw of polys){const poly=orient(raw);if(poly.length<3)continue;const start=nodes.length;for(const p of poly)nodes.push({anchor:p,inHandle:null,outHandle:null,kind:'corner'});segments.push({type:'move',to:start});for(let i=1;i<poly.length;i++)segments.push({type:'line',to:start+i});segments.push({type:'line',to:start});}return {nodes,segments,closed:true,fillRule:'nonzero'}; }
export function booleanPath(a:VectorObject,b:VectorObject,op:'union'|'subtract'|'intersect'|'exclude'):VectorPath {
 let pa=objectPolygon(a),pb=objectPolygon(b); if(pa.length<3||pb.length<3||!isConvex(pa)||!isConvex(pb))throw new Error('当前布尔内核支持凸多边形及矩形、椭圆；非凸路径请先分解为凸形状');
 const intersection=clipConvex(pa,pb); if(op==='intersect')return toPath(intersection.length>=3?[intersection]:[]);
 if(op==='subtract')return toPath(differenceConvex(pa,pb));
 if(op==='union')return toPath([pa,pb]);
 return toPath([...differenceConvex(pa,pb),...differenceConvex(pb,pa)]);
}
