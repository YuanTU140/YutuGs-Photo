import type { EditorObject, Id, Point, SelectionState } from './model';
import { getObjectBounds, hitTest, unionBounds } from './geometry';

export const emptySelection = (): SelectionState => ({ objectIds: [], activeObjectId: null, artboardId: null });
export function selectObject(state:SelectionState,id:Id,options:{additive?:boolean;toggle?:boolean;artboardId?:Id|null}={}):SelectionState {
  const has=state.objectIds.includes(id);
  let ids=options.additive||options.toggle?[...state.objectIds]:[];
  if(options.toggle&&has) ids=ids.filter(item=>item!==id); else if(!ids.includes(id)) ids.push(id);
  return {objectIds:ids,activeObjectId:ids.includes(id)?id:(ids.at(-1)??null),artboardId:options.artboardId??state.artboardId};
}
export function selectByPoint(state:SelectionState,objects:EditorObject[],point:Point,options:{additive?:boolean;toggle?:boolean;tolerance?:number;artboardId?:Id|null}={}):SelectionState {
  const found=hitTest(objects,point,options.tolerance);
  if(!found)return options.additive||options.toggle?state:emptySelection();
  return selectObject(state,found.id,{additive:options.additive,toggle:options.toggle,artboardId:options.artboardId});
}
export function selectInRectangle(objects:EditorObject[],a:Point,b:Point):Id[] {
  const rect={minX:Math.min(a.x,b.x),minY:Math.min(a.y,b.y),maxX:Math.max(a.x,b.x),maxY:Math.max(a.y,b.y)};
  return objects.filter(o=>{const box=getObjectBounds(o);return !!box&&box.minX>=rect.minX&&box.minY>=rect.minY&&box.maxX<=rect.maxX&&box.maxY<=rect.maxY;}).map(o=>o.id);
}

export function getSelectionBounds(objects: EditorObject[], ids: Id[]) {
  return unionBounds(objects.filter(object => ids.includes(object.id)).map(getObjectBounds).filter((box): box is NonNullable<typeof box> => Boolean(box)));
}
