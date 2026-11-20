import type { Point, ProjectiveMatrix } from './model';
import type { Bounds } from './geometry';

export const identityProjective = (): ProjectiveMatrix => [1,0,0,0,1,0,0,0,1];
export function applyProjective(point: Point, m: ProjectiveMatrix): Point {
  const w=m[6]*point.x+m[7]*point.y+m[8];
  if(Math.abs(w)<1e-10) throw new Error('Projective transform maps a point to infinity');
  return {x:(m[0]*point.x+m[1]*point.y+m[2])/w,y:(m[3]*point.x+m[4]*point.y+m[5])/w};
}
export function multiplyProjective(a: ProjectiveMatrix,b: ProjectiveMatrix): ProjectiveMatrix {
  const out:number[]=[];
  for(let r=0;r<3;r++)for(let c=0;c<3;c++)out[r*3+c]=a[r*3]*b[c]+a[r*3+1]*b[3+c]+a[r*3+2]*b[6+c];
  return out as ProjectiveMatrix;
}
export function invertProjective(m: ProjectiveMatrix): ProjectiveMatrix {
  const [a,b,c,d,e,f,g,h,i]=m;
  const A=e*i-f*h,B=f*g-d*i,C=d*h-e*g,D=c*h-b*i,E=a*i-c*g,F=b*g-a*h,G=b*f-c*e,H=c*d-a*f,I=a*e-b*d;
  const det=a*A+b*B+c*C;
  if(Math.abs(det)<1e-12)throw new Error('Projective transform is singular');
  return [A/det,D/det,G/det,B/det,E/det,H/det,C/det,F/det,I/det];
}
function solveLinear(matrix:number[][], values:number[]):number[] {
  const n=values.length, a=matrix.map((row,i)=>[...row,values[i]]);
  for(let col=0;col<n;col++){
    let pivot=col;for(let row=col+1;row<n;row++)if(Math.abs(a[row][col])>Math.abs(a[pivot][col]))pivot=row;
    if(Math.abs(a[pivot][col])<1e-12)throw new Error('透视四边形退化，无法计算变换');
    [a[col],a[pivot]]=[a[pivot],a[col]];
    const divisor=a[col][col];for(let j=col;j<=n;j++)a[col][j]/=divisor;
    for(let row=0;row<n;row++){if(row===col)continue;const factor=a[row][col];for(let j=col;j<=n;j++)a[row][j]-=factor*a[col][j];}
  }
  return a.map(row=>row[n]);
}
export function projectiveFromRectToQuad(bounds:Bounds, quad:[Point,Point,Point,Point]):ProjectiveMatrix {
  const source:[Point,Point,Point,Point]=[{x:bounds.minX,y:bounds.minY},{x:bounds.maxX,y:bounds.minY},{x:bounds.maxX,y:bounds.maxY},{x:bounds.minX,y:bounds.maxY}];
  const rows:number[][]=[], values:number[]=[];
  source.forEach((p,index)=>{const q=quad[index];rows.push([p.x,p.y,1,0,0,0,-q.x*p.x,-q.x*p.y]);values.push(q.x);rows.push([0,0,0,p.x,p.y,1,-q.y*p.x,-q.y*p.y]);values.push(q.y);});
  const h=solveLinear(rows,values);const result:ProjectiveMatrix=[h[0],h[1],h[2],h[3],h[4],h[5],h[6],h[7],1];const denominators=source.map(p=>result[6]*p.x+result[7]*p.y+result[8]);if(denominators.some(value=>!Number.isFinite(value)||Math.abs(value)<1e-8)||denominators.some(value=>Math.sign(value)!==Math.sign(denominators[0])))throw new Error('透视四边形跨越无穷远线或退化，请调整角点');return result;
}
export function projectiveToCssMatrix3d(m:ProjectiveMatrix):string {
  const values=[m[0],m[3],0,m[6],m[1],m[4],0,m[7],0,0,1,0,m[2],m[5],0,m[8]];
  return `matrix3d(${values.join(',')})`;
}
export function projectiveIdentity(m?:ProjectiveMatrix):boolean { return !m||m.every((v,i)=>Math.abs(v-identityProjective()[i])<1e-10); }

/** Lift a 2D affine matrix [a,b,c,d,e,f] into a row-major 3x3 homography. */
export function affineToProjective(m: readonly [number,number,number,number,number,number]):ProjectiveMatrix {
  return [m[0],m[2],m[4],m[1],m[3],m[5],0,0,1];
}
