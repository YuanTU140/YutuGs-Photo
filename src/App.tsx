import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { FilePlus2, MousePointer2, PenTool, Square, Circle, Hand, ZoomIn, ZoomOut, Layers3, PanelLeft, PanelRight, Save, Undo2, Redo2, AlignStartVertical, AlignCenterHorizontal, AlignEndVertical, Trash2 } from 'lucide-react';
import { createDocument, createId, identityMatrix } from './core/model';
import type { EditorObject, Id, Point } from './core/model';
import type { EditorCommand } from './core/commands';
import { createHistory, dispatch, redo, undo } from './core/history';
import type { HistoryState } from './core/history';
import { defaultViewport, panBy, screenToDocument, zoomAt } from './core/viewport';
import type { Viewport } from './core/viewport';
import { getObjectBounds, hitTest, multiplyMatrices, unionBounds } from './core/geometry';
import { createInteractiveTransform } from './core/transform';
import { emptySelection, getSelectionBounds, selectByPoint, selectInRectangle } from './core/selection';
import type { SelectionState } from './core/model';
import SvgArtboard from './renderer/SvgArtboard';
import { importSvgText } from './io/svg';
import { encodeYgs, decodeYgs } from './persistence/ygs';

type HistoryAction = { type: 'undo' } | { type: 'redo' } | { type: 'command'; command: EditorCommand } | { type: 'replace'; document: ReturnType<typeof createDocument> };
function historyReducer(state: HistoryState, action: HistoryAction) {
  switch (action.type) {
    case 'undo': return undo(state);
    case 'redo': return redo(state);
    case 'replace': return createHistory(action.document);
    case 'command': return dispatch(state, action.command);
  }
}
type DragState = { kind: 'move'|'marquee'|'resize'|'rotate'|'draw'|'pan'; pointerId: number; start: Point; current: Point; ids: Id[]; initial: Record<string, EditorObject['transform']>; bounds: NonNullable<ReturnType<typeof getSelectionBounds>> | null; handle?: import('./core/transform').TransformHandle; additive: boolean; tool?: string; viewportStart?: Viewport };
const HANDLE_POINTS: import('./core/transform').TransformHandle[] = ['nw','n','ne','e','se','s','sw','w'];
function pointFromEvent(event: React.PointerEvent, element: HTMLElement, viewport: Viewport) {
  const rect=element.getBoundingClientRect();
  return screenToDocument({x:event.clientX-rect.left,y:event.clientY-rect.top},viewport);
}
export default function App() {
  const [history, setHistory] = useReducer(historyReducer, undefined, () => createHistory(createDocument()));
  const [viewport, setViewport] = useState(defaultViewport());
  const [activeTool, setActiveTool] = useState('select');
  const [selection, setSelection] = useState<SelectionState>(emptySelection);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const openInputRef = useRef<HTMLInputElement>(null);
  const svgInputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState<DragState|null>(null);
  const [previewTransforms,setPreviewTransforms]=useState<Record<string,EditorObject['transform']>>({});
  const stageRef=useRef<HTMLDivElement>(null);
  const dragRef=useRef<DragState|null>(null);
  const spacePressed=useRef(false);
  const doc = history.document;
  const artboard = doc.artboards[0];
  const objects = useMemo(()=>Object.values(doc.objects),[doc.objects]);
  const selectedObjects=useMemo(()=>selection.objectIds.map(id=>doc.objects[id]).filter((item):item is EditorObject=>Boolean(item)),[selection.objectIds,doc.objects]);
  const selectionBounds=useMemo(()=>getSelectionBounds(objects,selection.objectIds),[objects,selection.objectIds]);
  const zoomLabel = useMemo(() => `${Math.round(viewport.zoom * 100)}%`, [viewport.zoom]);
  const saveDocument = async () => {
    const blob = await encodeYgs(doc); const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `${doc.name || 'untitled'}.ygs`; anchor.click(); URL.revokeObjectURL(url);
  };
  const openDocument = async (file: File) => { try { setHistory({type:'replace',document:await decodeYgs(file)}); setSelection(emptySelection()); } catch(error) { window.alert(`无法打开 YGS 文件：${error instanceof Error?error.message:String(error)}`); } };
  const addArtboard = () => {
    const layerId = createId('layer'), artboardId = createId('artboard');
    const newArtboard = { id: artboardId, name: `画板 ${doc.artboards.length + 1}`, x: artboard.x + artboard.width + 80, y: artboard.y, width: artboard.width, height: artboard.height, background: '#ffffff' as const, layerIds: [layerId] };
    const newLayer = { id: layerId, name: '图层 1', visible: true, locked: false, opacity: 1, objectIds: [], parentId: null, blendMode: 'normal', kind: 'vector' as const };
    setHistory({ type: 'command', command: { type: 'artboard.add', artboard: newArtboard, layer: newLayer } });
  };
  const commitTransforms=(transforms:Record<string,EditorObject['transform']>)=>{
    const entries=Object.entries(transforms).filter(([id,m])=>doc.objects[id]&&m.some((v,i)=>Math.abs(v-doc.objects[id].transform[i])>1e-8)).map(([id,matrix])=>({id,matrix}));
    if(entries.length)setHistory({type:'command',command:{type:'object.transform.batch',transforms:entries}});
  };
  const getHandleAt=(screen:Point):import('./core/transform').TransformHandle|undefined=>{
    if(!selectionBounds)return;
    const x1=selectionBounds.minX*viewport.zoom+viewport.panX,x2=selectionBounds.maxX*viewport.zoom+viewport.panX;
    const y1=selectionBounds.minY*viewport.zoom+viewport.panY,y2=selectionBounds.maxY*viewport.zoom+viewport.panY;
    const cx=(x1+x2)/2,cy=(y1+y2)/2;
    const pts:Record<import('./core/transform').TransformHandle,Point>={nw:{x:x1,y:y1},n:{x:cx,y:y1},ne:{x:x2,y:y1},e:{x:x2,y:cy},se:{x:x2,y:y2},s:{x:cx,y:y2},sw:{x:x1,y:y2},w:{x:x1,y:cy},rotate:{x:cx,y:y1-36}};
    for(const key of [...HANDLE_POINTS,'rotate'] as import('./core/transform').TransformHandle[])if(Math.hypot(screen.x-pts[key].x,screen.y-pts[key].y)<10)return key;
    return;
  };
  const onPointerDown=(event:React.PointerEvent<HTMLDivElement>)=>{
    if(!stageRef.current)return;
    const rect=stageRef.current.getBoundingClientRect(),screen={x:event.clientX-rect.left,y:event.clientY-rect.top};
    const shouldPan=event.button===1||(spacePressed.current&&(event.button===0||event.button===2));
    if(shouldPan){event.preventDefault();const next:DragState={kind:'pan',pointerId:event.pointerId,start:screen,current:screen,ids:[],initial:{},bounds:null,additive:false,viewportStart:viewport};dragRef.current=next;setDrag(next);stageRef.current.setPointerCapture(event.pointerId);return;}
    if(event.button!==0)return;
    const point=screenToDocument(screen,viewport);
    const additive=event.shiftKey;
    let next:DragState|null=null;
    if(activeTool==='select'&&selection.objectIds.length){
      const handle=getHandleAt(screen);
      if(handle&&selectionBounds){const initial=Object.fromEntries(selection.objectIds.map(id=>[id,doc.objects[id].transform]));next={kind:handle==='rotate'?'rotate':'resize',pointerId:event.pointerId,start:point,current:point,ids:[...selection.objectIds],initial,bounds:selectionBounds,handle,additive};}
    }
    if(!next&&activeTool==='select'){
      const hit=hitTest(objects,point,6/viewport.zoom);
      const found=hit&&selection.objectIds.includes(hit.id)&&!additive?selection:selectByPoint(selection,objects,point,{additive,toggle:additive,tolerance:6/viewport.zoom,artboardId:artboard.id});
      setSelection(found);
      const ids=found.objectIds;
      if(hit&&ids.includes(hit.id)&&!additive){const initial=Object.fromEntries(ids.map(id=>[id,doc.objects[id].transform]));next={kind:'move',pointerId:event.pointerId,start:point,current:point,ids,initial,bounds:getSelectionBounds(objects,ids),additive};}
      else if(!hit)next={kind:'marquee',pointerId:event.pointerId,start:point,current:point,ids:selection.objectIds,initial:{},bounds:null,additive};
    } else if(!next&&(activeTool==='rect'||activeTool==='ellipse')) next={kind:'draw',pointerId:event.pointerId,start:point,current:point,ids:[],initial:{},bounds:null,additive,tool:activeTool};
    if(next){dragRef.current=next;setDrag(next);stageRef.current.setPointerCapture(event.pointerId);}
  };
  const onPointerMove=(event:React.PointerEvent<HTMLDivElement>)=>{
    const current=dragRef.current;if(!current||current.pointerId!==event.pointerId||!stageRef.current)return;
    let point=current.kind==='pan'?{x:event.clientX-stageRef.current.getBoundingClientRect().left,y:event.clientY-stageRef.current.getBoundingClientRect().top}:pointFromEvent(event,stageRef.current,viewport);if(current.kind==='pan'&&current.viewportStart){setViewport(panBy(current.viewportStart,{x:point.x-current.start.x,y:point.y-current.start.y}));}if(current.kind==='move'&&current.bounds){const dx=Math.max(-current.bounds.minX,Math.min(artboard.width-current.bounds.maxX,point.x-current.start.x));const dy=Math.max(-current.bounds.minY,Math.min(artboard.height-current.bounds.maxY,point.y-current.start.y));point={x:current.start.x+dx,y:current.start.y+dy};}const updated={...current,current:point};dragRef.current=updated;setDrag(updated);
    if(current.kind==='move'||current.kind==='resize'||current.kind==='rotate'){
      const transforms:Record<string,EditorObject['transform']>={};
      for(const id of current.ids){const object=doc.objects[id];if(object)transforms[id]=createInteractiveTransform(current.initial[id],current.kind,current.start,point,current.bounds,current.handle);}
      setPreviewTransforms(transforms);
    }
  };
  const onPointerUp=(event:React.PointerEvent<HTMLDivElement>)=>{
    let current=dragRef.current;if(!current||current.pointerId!==event.pointerId)return;
    if(stageRef.current){let point=current.kind==='pan'?{x:event.clientX-stageRef.current.getBoundingClientRect().left,y:event.clientY-stageRef.current.getBoundingClientRect().top}:pointFromEvent(event,stageRef.current,viewport);if(current.kind==='pan'&&current.viewportStart){setViewport(panBy(current.viewportStart,{x:point.x-current.start.x,y:point.y-current.start.y}));}if(current.kind==='move'&&current.bounds){const dx=Math.max(-current.bounds.minX,Math.min(artboard.width-current.bounds.maxX,point.x-current.start.x));const dy=Math.max(-current.bounds.minY,Math.min(artboard.height-current.bounds.maxY,point.y-current.start.y));point={x:current.start.x+dx,y:current.start.y+dy};}current={...current,current:point};}
    if(current.kind==='move'||current.kind==='resize'||current.kind==='rotate'){const finalTransforms:Record<string,EditorObject['transform']>={};for(const id of current.ids){const object=doc.objects[id];if(object)finalTransforms[id]=createInteractiveTransform(current.initial[id],current.kind,current.start,current.current,current.bounds,current.handle);}commitTransforms(finalTransforms);}
    if(current.kind==='marquee'){
      const ids=selectInRectangle(objects,current.start,current.current);
      setSelection({objectIds:current.additive?[...new Set([...current.ids,...ids])]:ids,activeObjectId:ids.at(-1)??(current.additive?current.ids.at(-1)??null:null),artboardId:artboard.id});
    }
    if(current.kind==='draw'){
      const x=Math.min(current.start.x,current.current.x),y=Math.min(current.start.y,current.current.y),width=Math.abs(current.current.x-current.start.x),height=Math.abs(current.current.y-current.start.y);
      if(width>2&&height>2){const layer=doc.layers.find(item=>artboard.layerIds.includes(item.id)&&!item.locked);if(layer){const object:EditorObject={id:createId(current.tool),name:current.tool==='rect'?'矩形':'椭圆',kind:current.tool==='rect'?'rect':'ellipse',geometry:{x,y,width,height},transform:identityMatrix(),opacity:1,visible:true,locked:false,layerId:layer.id,fill:'#8d6bea',stroke:'#d8c9ff',strokeWidth:2};setHistory({type:'command',command:{type:'object.add',object}});setSelection({objectIds:[object.id],activeObjectId:object.id,artboardId:artboard.id});}}
    }
    dragRef.current=null;setDrag(null);setPreviewTransforms({});
  };
  const cancelDrag=()=>{const current=dragRef.current;if(current?.kind==='pan'&&current.viewportStart)setViewport(current.viewportStart);dragRef.current=null;setDrag(null);setPreviewTransforms({});};
  const nudge=(dx:number,dy:number)=>{if(!selection.objectIds.length)return;const transforms=Object.fromEntries(selection.objectIds.map(id=>{const m=doc.objects[id].transform;return [id,multiplyMatrices([1,0,0,1,dx,dy],m)]}));commitTransforms(transforms);};
  const deleteSelection=()=>{if(selection.objectIds.length){setHistory({type:'command',command:{type:'object.delete',ids:selection.objectIds}});setSelection(emptySelection());}};
  const importSvgFile=async(file:File)=>{try{const result=importSvgText(await file.text(),file.name);setHistory({type:'replace',document:result.document});setSelection(emptySelection());if(result.warnings.length)window.alert(`SVG 已导入，但有以下限制：\n\n${result.warnings.join('\n')}`);}catch(error){window.alert(`SVG 导入失败：${error instanceof Error?error.message:String(error)}`);}};
  const downloadText=(name:string,content:string,mime='image/svg+xml')=>{const blob=new Blob([content],{type:mime});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);};
  const newDocument=()=>{const width=Number(window.prompt('新建文档宽度（px）','1920'));if(!Number.isFinite(width)||width<1)return;const height=Number(window.prompt('新建文档高度（px）','1080'));if(!Number.isFinite(height)||height<1)return;const name=window.prompt('文档名称','未命名设计')||'未命名设计';setHistory({type:'replace',document:createDocument(name,Math.round(width),Math.round(height))});setSelection(emptySelection());setViewport(defaultViewport());};
  const resizeArtboard=()=>{const width=Number(window.prompt('画布宽度（px）',String(artboard.width)));if(!Number.isFinite(width)||width<1)return;const height=Number(window.prompt('画布高度（px）',String(artboard.height)));if(!Number.isFinite(height)||height<1)return;setHistory({type:'command',command:{type:'artboard.resize',id:artboard.id,width:Math.round(width),height:Math.round(height)}});};
  const exportSvg=()=>{const esc=(v:string)=>v.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');const nodes:string[]=[];for(const layerId of artboard.layerIds){for(const object of objects.filter(o=>o.layerId===layerId&&o.visible)){if(object.kind==='image')continue;const v=object as import('./core/model').VectorObject;const transform=`matrix(${object.transform.join(' ')})`;const paint=`fill="${esc(v.fill??'none')}" stroke="${esc(v.stroke??'none')}" stroke-width="${v.strokeWidth}" opacity="${object.opacity}" transform="${transform}"`;if(v.kind==='rect'||v.kind==='ellipse'){const g=v.geometry as {x:number;y:number;width:number;height:number};nodes.push(v.kind==='rect'?`<rect x="${g.x}" y="${g.y}" width="${g.width}" height="${g.height}" ${paint}/>`:`<ellipse cx="${g.x+g.width/2}" cy="${g.y+g.height/2}" rx="${g.width/2}" ry="${g.height/2}" ${paint}/>`);}else if(v.kind==='text'){const g=v.geometry as {x:number;y:number;text:string;fontSize:number;fontFamily:string};nodes.push(`<text x="${g.x}" y="${g.y}" font-size="${g.fontSize}" font-family="${esc(g.fontFamily)}" ${paint}>${esc(g.text)}</text>`);}else{const g=v.geometry as import('./core/model').VectorPath;const d=g.segments.map(seg=>{const end=g.nodes[seg.to]?.anchor;if(!end)return '';if(seg.type==='move')return `M ${end.x} ${end.y}`;if(seg.type==='line')return `L ${end.x} ${end.y}`;if(seg.type==='quadratic'&&seg.control)return `Q ${seg.control.x} ${seg.control.y} ${end.x} ${end.y}`;if(seg.type==='cubic'&&seg.from!==undefined){const a=g.nodes[seg.from],c1=a.outHandle??a.anchor,c2=g.nodes[seg.to].inHandle??end;return `C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${end.x} ${end.y}`;}return '';}).join(' ')+(g.closed?' Z':'');nodes.push(`<path d="${d}" ${paint} fill-rule="${g.fillRule}"/>`);}}}const svg=`<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${artboard.width}" height="${artboard.height}" viewBox="0 0 ${artboard.width} ${artboard.height}"><rect width="100%" height="100%" fill="${artboard.background==='transparent'?'none':artboard.background}"/>${nodes.join('')}</svg>`;downloadText(`${doc.name||'untitled'}.svg`,svg);};
  const addTextObject=()=>{const text=window.prompt('输入文字内容','新建文字');if(!text)return;const layer=doc.layers.find(l=>l.id===artboard.layerIds[0]);if(!layer)return;const object:EditorObject={id:createId('object'),name:text.slice(0,24),kind:'text',geometry:{x:80,y:120,text,fontSize:48,fontFamily:'Arial'},transform:identityMatrix(),opacity:1,visible:true,locked:false,layerId:layer.id,fill:'#111111',stroke:null,strokeWidth:1};setHistory({type:'command',command:{type:'object.add',object}});};
  const menuItems:Record<string,{label:string;run?:()=>void;disabled?:boolean;hint?:string}[]>={
    '文件':[{label:'新建…',run:newDocument,hint:'Ctrl+N'},{label:'打开 YGS…',run:()=>openInputRef.current?.click(),hint:'Ctrl+O'},{label:'导入 SVG…',run:()=>svgInputRef.current?.click()},{label:'保存 YGS',run:()=>void saveDocument(),hint:'Ctrl+S'},{label:'导出 SVG…',run:exportSvg},{label:'另存为…',disabled:true,hint:'其他格式保存尚未实现'},{label:'打开为…',disabled:true,hint:'格式转换导入尚未实现'},{label:'关闭文档',run:()=>{setHistory({type:'replace',document:createDocument()});setSelection(emptySelection());}},{label:'关闭全部',run:()=>{setHistory({type:'replace',document:createDocument()});setSelection(emptySelection());}},{label:'打印 / 打印预览',disabled:true,hint:'打印管线尚未实现'},{label:'退出',disabled:true,hint:'请关闭应用窗口'}],
    '编辑':[{label:'撤销',run:()=>setHistory({type:'undo'}),disabled:!history.past.length,hint:'Ctrl+Z'},{label:'重做',run:()=>setHistory({type:'redo'}),disabled:!history.future.length,hint:'Ctrl+Y'},{label:'删除所选对象',run:deleteSelection,disabled:!selection.objectIds.length,hint:'Delete'},{label:'全选对象',run:()=>setSelection({objectIds:objects.map(o=>o.id),activeObjectId:objects[objects.length-1]?.id??null,artboardId:artboard.id}),disabled:!objects.length,hint:'Ctrl+A'}],
    '图像':[{label:'画布大小…',run:resizeArtboard},{label:'图像大小…',disabled:true,hint:'位图重采样尚未实现'}],
    '图层':[{label:'新建文字对象…',run:addTextObject},{label:'删除所选对象',run:deleteSelection,disabled:!selection.objectIds.length},{label:'新建图层',disabled:true,hint:'图层新增命令尚未接入'}],
    '对象':[{label:'左对齐',run:()=>setHistory({type:'command',command:{type:'object.align',ids:selection.objectIds,axis:'left'}}),disabled:selection.objectIds.length<2},{label:'水平居中',run:()=>setHistory({type:'command',command:{type:'object.align',ids:selection.objectIds,axis:'center-x'}}),disabled:selection.objectIds.length<2},{label:'右对齐',run:()=>setHistory({type:'command',command:{type:'object.align',ids:selection.objectIds,axis:'right'}}),disabled:selection.objectIds.length<2},{label:'水平等间距分布',run:()=>setHistory({type:'command',command:{type:'object.distribute',ids:selection.objectIds,axis:'horizontal'}}),disabled:selection.objectIds.length<3},{label:'垂直等间距分布',run:()=>setHistory({type:'command',command:{type:'object.distribute',ids:selection.objectIds,axis:'vertical'}}),disabled:selection.objectIds.length<3}],
    '路径':[{label:'联合 / 减去 / 相交 / 排除',disabled:true,hint:'可编辑布尔运算尚未实现'},{label:'路径查找器',disabled:true,hint:'路径查找器尚未实现'}],
    '文字':[{label:'新建文字…',run:addTextObject},{label:'查找/替换…',disabled:true,hint:'文字对象查找替换尚未实现'}],
    '选择':[{label:'全选',run:()=>setSelection({objectIds:objects.map(o=>o.id),activeObjectId:objects[objects.length-1]?.id??null,artboardId:artboard.id}),disabled:!objects.length},{label:'取消选择',run:()=>setSelection(emptySelection()),disabled:!selection.objectIds.length}],
    '滤镜':[{label:'高斯模糊',disabled:true,hint:'滤镜渲染管线尚未实现'},{label:'调整图层',disabled:true,hint:'调整图层渲染尚未实现'}],
    '视图':[{label:'放大',run:()=>setViewport(v=>zoomAt(v,{x:500,y:350},v.zoom*1.2))},{label:'缩小',run:()=>setViewport(v=>zoomAt(v,{x:500,y:350},v.zoom/1.2))},{label:'重置视图',run:()=>setViewport(defaultViewport())},{label:'标尺与参考线',disabled:true,hint:'标尺/参考线系统尚未接入'}],
    '窗口':[{label:leftOpen?'隐藏工具面板':'显示工具面板',run:()=>setLeftOpen(v=>!v)},{label:rightOpen?'隐藏属性面板':'显示属性面板',run:()=>setRightOpen(v=>!v)}],
    '帮助':[{label:'关于 YutuGs-Photo',run:()=>window.alert('YutuGs-Photo 1.1.1-alpha\nSVG 对象内核 · YGS v2 文档模型')}]
  };
  useEffect(()=>{const handler=(event:KeyboardEvent)=>{const target=event.target as HTMLElement|null;if(target&&(target.tagName==='INPUT'||target.tagName==='TEXTAREA'||target.isContentEditable))return;
    if(event.code==='Space'){spacePressed.current=true;event.preventDefault();return;}
    if(event.key==='Escape'){cancelDrag();setSelection(emptySelection());}
    else if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();deleteSelection();}
    else if(event.key==='ArrowLeft'||event.key==='ArrowRight'||event.key==='ArrowUp'||event.key==='ArrowDown'){event.preventDefault();const amount=event.shiftKey?10:1;nudge(event.key==='ArrowLeft'?-amount:event.key==='ArrowRight'?amount:0,event.key==='ArrowUp'?-amount:event.key==='ArrowDown'?amount:0);}
    else if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='n'){event.preventDefault();newDocument();}
    else if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='o'){event.preventDefault();openInputRef.current?.click();}
    else if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();void saveDocument();}
    else if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='a'){event.preventDefault();setSelection({objectIds:objects.map(o=>o.id),activeObjectId:objects[objects.length-1]?.id??null,artboardId:artboard.id});}
    else if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();setHistory({type:event.shiftKey?'redo':'undo'});}
    else if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='y'){event.preventDefault();setHistory({type:'redo'});}
  };const releaseSpace=(event:KeyboardEvent)=>{if(event.code==='Space')spacePressed.current=false;};const clearSpace=()=>{spacePressed.current=false;};window.addEventListener('keydown',handler);window.addEventListener('keyup',releaseSpace);window.addEventListener('blur',clearSpace);return()=>{window.removeEventListener('keydown',handler);window.removeEventListener('keyup',releaseSpace);window.removeEventListener('blur',clearSpace);};});
  const onWheel=(event:React.WheelEvent<HTMLDivElement>)=>{if(!event.altKey||!stageRef.current)return;event.preventDefault();const rect=stageRef.current.getBoundingClientRect();const anchor={x:event.clientX-rect.left,y:event.clientY-rect.top};const factor=Math.exp(-event.deltaY*0.002);setViewport(v=>zoomAt(v,anchor,v.zoom*factor));};
  const marquee=drag?.kind==='marquee'?{x:Math.min(drag.start.x,drag.current.x),y:Math.min(drag.start.y,drag.current.y),width:Math.abs(drag.current.x-drag.start.x),height:Math.abs(drag.current.y-drag.start.y)}:null;
  const previewBounds=useMemo(()=>{if(!Object.keys(previewTransforms).length)return selectionBounds;return unionBounds(selectedObjects.map(o=>({...o,transform:previewTransforms[o.id]??o.transform})).map(getObjectBounds).filter((b):b is NonNullable<typeof b>=>Boolean(b)));},[previewTransforms,selectionBounds,selectedObjects]);
  return <div className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark">Y</span><strong>YutuGs-Photo</strong><small>全新内核 · Alpha</small></div><nav>{['文件','编辑','图像','图层','文字','对象','路径','选择','滤镜','视图','窗口','帮助'].map(name=><div className="menu-wrap" key={name}><button className={openMenu===name?'menu-trigger active':'menu-trigger'} onClick={()=>setOpenMenu(v=>v===name?null:name)}>{name}</button>{openMenu===name&&<div className="menu-dropdown">{menuItems[name].map((item,i)=><button key={i} disabled={item.disabled} title={item.hint} onClick={()=>{setOpenMenu(null);item.run?.();}}><span>{item.label}</span><small>{item.hint??(item.disabled?'未实现':'')}</small></button>)}</div>}</div>)}</nav><div className="top-actions"><label className="file-open" title="打开 YGS 文档">打开<input ref={openInputRef} type="file" accept=".ygs,application/vnd.yutugs.ygs+json,application/json" onChange={e=>{const file=e.target.files?.[0];if(file)void openDocument(file);e.currentTarget.value='';}}/></label><button title="保存 YGS v2" onClick={saveDocument}><Save size={16}/></button></div><input ref={svgInputRef} type="file" accept=".svg,image/svg+xml" hidden onChange={e=>{const file=e.target.files?.[0];if(file)void importSvgFile(file);e.currentTarget.value='';}}/></header>
    <div className="workspace">
      {leftOpen && <aside className="left-panel"><div className="panel-heading">工具</div><div className="tool-grid">{[[MousePointer2,'选择','select'],[Hand,'抓手','hand'],[PenTool,'钢笔（待实现）','pen'],[Square,'矩形','rect'],[Circle,'椭圆','ellipse']].map(([Icon,label,key])=>{const I=Icon as typeof MousePointer2;return <button key={String(key)} className={activeTool===key?'tool active':'tool'} title={String(label)} onClick={()=>setActiveTool(String(key))}><I size={18}/></button>;})}</div><div className="panel-heading">对象</div><div className="selection-actions"><button title="左对齐" disabled={selectedObjects.length<2} onClick={()=>setHistory({type:'command',command:{type:'object.align',ids:selection.objectIds,axis:'left'}})}><AlignStartVertical size={15}/></button><button title="水平居中" disabled={selectedObjects.length<2} onClick={()=>setHistory({type:'command',command:{type:'object.align',ids:selection.objectIds,axis:'center-x'}})}><AlignCenterHorizontal size={15}/></button><button title="右对齐" disabled={selectedObjects.length<2} onClick={()=>setHistory({type:'command',command:{type:'object.align',ids:selection.objectIds,axis:'right'}})}><AlignEndVertical size={15}/></button><button title="水平等间距分布（至少选择三个对象）" disabled={selectedObjects.length<3} onClick={()=>setHistory({type:'command',command:{type:'object.distribute',ids:selection.objectIds,axis:'horizontal'}})}>水平分布</button><button title="垂直等间距分布（至少选择三个对象）" disabled={selectedObjects.length<3} onClick={()=>setHistory({type:'command',command:{type:'object.distribute',ids:selection.objectIds,axis:'vertical'}})}>垂直分布</button><button title="删除所选对象" disabled={!selection.objectIds.length} onClick={deleteSelection}><Trash2 size={15}/></button></div><div className="doc-meta"><b>{doc.name}</b><span>{doc.colorMode} · {doc.resolutionDpi} DPI</span><span>{doc.artboards.length} 个画板</span><span>{selection.objectIds.length} 个对象已选择</span></div><button className="panel-action" onClick={addArtboard}><FilePlus2 size={15}/> 新建画板</button></aside>}
      <main className="canvas-area"><div className="canvas-toolbar"><span>{artboard.name} · {selection.objectIds.length?`已选 ${selection.objectIds.length} 个对象`:'选择工具：拖拽对象移动，拖动画布空白处框选'}</span><div><button title="撤销" onClick={()=>setHistory({type:'undo'})} disabled={!history.past.length}><Undo2 size={14}/></button><button title="重做" onClick={()=>setHistory({type:'redo'})} disabled={!history.future.length}><Redo2 size={14}/></button><button onClick={()=>setViewport(v=>zoomAt(v,{x:500,y:350},v.zoom/1.2))}><ZoomOut size={15}/></button><span>{zoomLabel}</span><button onClick={()=>setViewport(v=>zoomAt(v,{x:500,y:350},v.zoom*1.2))}><ZoomIn size={15}/></button></div></div><div className={drag?.kind==='pan'?'canvas-stage panning':'canvas-stage'} ref={stageRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={cancelDrag} onWheel={onWheel} onContextMenu={e=>e.preventDefault()}>
        <div className="stage-grid"/><div className="artboard-shadow" style={{left:viewport.panX,top:viewport.panY,width:artboard.width*viewport.zoom,height:artboard.height*viewport.zoom}}/><SvgArtboard artboard={artboard} objects={doc.objects} viewport={viewport} previewTransforms={previewTransforms} selectionBounds={previewBounds} marquee={marquee}/>
        {!objects.length&&!drag&&<div className="welcome-hint">交互式选择与变换已接入<br/><span>先选择矩形或椭圆工具，在画板上拖拽绘制；再使用选择工具移动、缩放或旋转对象。</span></div>}
      </div></main>
      {rightOpen && <aside className="right-panel"><div className="panel-heading">属性</div>{selectionBounds?<div className="selection-info"><b>{selectedObjects.length} 个对象</b><span>X：{Math.round(selectionBounds.minX)} px</span><span>Y：{Math.round(selectionBounds.minY)} px</span><span>宽：{Math.round(selectionBounds.width)} px</span><span>高：{Math.round(selectionBounds.height)} px</span><small>拖动边角缩放，拖动顶部圆柄旋转；方向键微移，Shift + 方向键移动 10 px。</small></div>:<div className="empty-state">选择一个对象以编辑属性</div>}<div className="panel-heading">画板</div>{doc.artboards.map(item=><div className="layer-row" key={item.id}><span className="layer-icon">▧</span><span>{item.name}</span><small>{item.width} × {item.height}</small></div>)}<div className="panel-heading">图层 / 对象</div>{doc.layers.map(layer=><div key={layer.id}><div className="layer-row"><Layers3 size={15}/><span>{layer.name}</span><small>{layer.kind}</small></div>{layer.objectIds.map(id=>{const object=doc.objects[id];return object?<button className={selection.objectIds.includes(id)?'layer-row object-row selected':'layer-row object-row'} key={id} onClick={()=>setSelection({objectIds:selection.objectIds.includes(id)?selection.objectIds:[...selection.objectIds,id],activeObjectId:id,artboardId:artboard.id})}><span>◇</span><span>{object.name}</span><small>{object.kind}</small></button>:null;})}</div>)}</aside>}
    </div>
    <footer className="statusbar"><span>YGS v2 文档模型</span><span>SVG Renderer · 非 Canvas 2D</span><span>选择 / 多选 / 拖动 / 缩放 / 旋转 / 撤销重做</span><div><button onClick={()=>setLeftOpen(v=>!v)}><PanelLeft size={14}/></button><button onClick={()=>setRightOpen(v=>!v)}><PanelRight size={14}/></button></div></footer>
  </div>;
}
