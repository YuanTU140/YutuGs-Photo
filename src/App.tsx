import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { FilePlus2, MousePointer2, PenTool, Square, Circle, Hand, ZoomIn, ZoomOut, Layers3, PanelLeft, PanelRight, Save, Undo2, Redo2, AlignStartVertical, AlignCenterHorizontal, AlignEndVertical, Trash2 } from 'lucide-react';
import { createDocument, createId, identityMatrix } from './core/model';
import type { EditorObject, Id, Point } from './core/model';
import type { EditorCommand } from './core/commands';
import { createHistory, dispatch, redo, undo } from './core/history';
import type { HistoryState } from './core/history';
import { defaultViewport, screenToDocument, zoomAt } from './core/viewport';
import type { Viewport } from './core/viewport';
import { getObjectBounds, hitTest, multiplyMatrices, unionBounds } from './core/geometry';
import { createInteractiveTransform } from './core/transform';
import { emptySelection, getSelectionBounds, selectByPoint, selectInRectangle } from './core/selection';
import type { SelectionState } from './core/model';
import SvgArtboard from './renderer/SvgArtboard';
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
type DragState = { kind: 'move'|'marquee'|'resize'|'rotate'|'draw'; pointerId: number; start: Point; current: Point; ids: Id[]; initial: Record<string, EditorObject['transform']>; bounds: NonNullable<ReturnType<typeof getSelectionBounds>> | null; handle?: import('./core/transform').TransformHandle; additive: boolean; tool?: string };
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
  const [drag, setDrag] = useState<DragState|null>(null);
  const [previewTransforms,setPreviewTransforms]=useState<Record<string,EditorObject['transform']>>({});
  const stageRef=useRef<HTMLDivElement>(null);
  const dragRef=useRef<DragState|null>(null);
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
    if(event.button!==0||!stageRef.current)return;
    const rect=stageRef.current.getBoundingClientRect(),screen={x:event.clientX-rect.left,y:event.clientY-rect.top},point=screenToDocument(screen,viewport);
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
    let point=pointFromEvent(event,stageRef.current,viewport);if(current.kind==='move'&&current.bounds){const dx=Math.max(-current.bounds.minX,Math.min(artboard.width-current.bounds.maxX,point.x-current.start.x));const dy=Math.max(-current.bounds.minY,Math.min(artboard.height-current.bounds.maxY,point.y-current.start.y));point={x:current.start.x+dx,y:current.start.y+dy};}const updated={...current,current:point};dragRef.current=updated;setDrag(updated);
    if(current.kind==='move'||current.kind==='resize'||current.kind==='rotate'){
      const transforms:Record<string,EditorObject['transform']>={};
      for(const id of current.ids){const object=doc.objects[id];if(object)transforms[id]=createInteractiveTransform(current.initial[id],current.kind,current.start,point,current.bounds,current.handle);}
      setPreviewTransforms(transforms);
    }
  };
  const onPointerUp=(event:React.PointerEvent<HTMLDivElement>)=>{
    let current=dragRef.current;if(!current||current.pointerId!==event.pointerId)return;
    if(stageRef.current){let point=pointFromEvent(event,stageRef.current,viewport);if(current.kind==='move'&&current.bounds){const dx=Math.max(-current.bounds.minX,Math.min(artboard.width-current.bounds.maxX,point.x-current.start.x));const dy=Math.max(-current.bounds.minY,Math.min(artboard.height-current.bounds.maxY,point.y-current.start.y));point={x:current.start.x+dx,y:current.start.y+dy};}current={...current,current:point};}
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
  const cancelDrag=()=>{dragRef.current=null;setDrag(null);setPreviewTransforms({});};
  const nudge=(dx:number,dy:number)=>{if(!selection.objectIds.length)return;const transforms=Object.fromEntries(selection.objectIds.map(id=>{const m=doc.objects[id].transform;return [id,multiplyMatrices([1,0,0,1,dx,dy],m)]}));commitTransforms(transforms);};
  const deleteSelection=()=>{if(selection.objectIds.length){setHistory({type:'command',command:{type:'object.delete',ids:selection.objectIds}});setSelection(emptySelection());}};
  useEffect(()=>{const handler=(event:KeyboardEvent)=>{const target=event.target as HTMLElement|null;if(target&&(target.tagName==='INPUT'||target.tagName==='TEXTAREA'||target.isContentEditable))return;
    if(event.key==='Escape'){cancelDrag();setSelection(emptySelection());}
    else if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();deleteSelection();}
    else if(event.key==='ArrowLeft'||event.key==='ArrowRight'||event.key==='ArrowUp'||event.key==='ArrowDown'){event.preventDefault();const amount=event.shiftKey?10:1;nudge(event.key==='ArrowLeft'?-amount:event.key==='ArrowRight'?amount:0,event.key==='ArrowUp'?-amount:event.key==='ArrowDown'?amount:0);}
    else if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();setHistory({type:event.shiftKey?'redo':'undo'});}
    else if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='y'){event.preventDefault();setHistory({type:'redo'});}
  };window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);});
  const marquee=drag?.kind==='marquee'?{x:Math.min(drag.start.x,drag.current.x),y:Math.min(drag.start.y,drag.current.y),width:Math.abs(drag.current.x-drag.start.x),height:Math.abs(drag.current.y-drag.start.y)}:null;
  const previewBounds=useMemo(()=>{if(!Object.keys(previewTransforms).length)return selectionBounds;return unionBounds(selectedObjects.map(o=>({...o,transform:previewTransforms[o.id]??o.transform})).map(getObjectBounds).filter((b):b is NonNullable<typeof b>=>Boolean(b)));},[previewTransforms,selectionBounds,selectedObjects]);
  return <div className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark">Y</span><strong>YutuGs-Photo</strong><small>全新内核 · Alpha</small></div><nav><span>文件</span><span>编辑</span><span>图像</span><span>图层</span><span>文字</span><span>选择</span><span>滤镜</span><span>视图</span><span>窗口</span><span>帮助</span></nav><div className="top-actions"><label className="file-open" title="打开 YGS 文档">打开<input type="file" accept=".ygs,application/vnd.yutugs.ygs+json,application/json" onChange={e=>{const file=e.target.files?.[0];if(file)void openDocument(file);e.currentTarget.value='';}}/></label><button title="保存 YGS v2" onClick={saveDocument}><Save size={16}/></button></div></header>
    <div className="workspace">
      {leftOpen && <aside className="left-panel"><div className="panel-heading">工具</div><div className="tool-grid">{[[MousePointer2,'选择','select'],[Hand,'抓手','hand'],[PenTool,'钢笔（待实现）','pen'],[Square,'矩形','rect'],[Circle,'椭圆','ellipse']].map(([Icon,label,key])=>{const I=Icon as typeof MousePointer2;return <button key={String(key)} className={activeTool===key?'tool active':'tool'} title={String(label)} onClick={()=>setActiveTool(String(key))}><I size={18}/></button>;})}</div><div className="panel-heading">对象</div><div className="selection-actions"><button title="左对齐" disabled={selectedObjects.length<2} onClick={()=>setHistory({type:'command',command:{type:'object.align',ids:selection.objectIds,axis:'left'}})}><AlignStartVertical size={15}/></button><button title="水平居中" disabled={selectedObjects.length<2} onClick={()=>setHistory({type:'command',command:{type:'object.align',ids:selection.objectIds,axis:'center-x'}})}><AlignCenterHorizontal size={15}/></button><button title="右对齐" disabled={selectedObjects.length<2} onClick={()=>setHistory({type:'command',command:{type:'object.align',ids:selection.objectIds,axis:'right'}})}><AlignEndVertical size={15}/></button><button title="删除所选对象" disabled={!selection.objectIds.length} onClick={deleteSelection}><Trash2 size={15}/></button></div><div className="doc-meta"><b>{doc.name}</b><span>{doc.colorMode} · {doc.resolutionDpi} DPI</span><span>{doc.artboards.length} 个画板</span><span>{selection.objectIds.length} 个对象已选择</span></div><button className="panel-action" onClick={addArtboard}><FilePlus2 size={15}/> 新建画板</button></aside>}
      <main className="canvas-area"><div className="canvas-toolbar"><span>{artboard.name} · {selection.objectIds.length?`已选 ${selection.objectIds.length} 个对象`:'选择工具：拖拽对象移动，拖动画布空白处框选'}</span><div><button title="撤销" onClick={()=>setHistory({type:'undo'})} disabled={!history.past.length}><Undo2 size={14}/></button><button title="重做" onClick={()=>setHistory({type:'redo'})} disabled={!history.future.length}><Redo2 size={14}/></button><button onClick={()=>setViewport(v=>zoomAt(v,{x:500,y:350},v.zoom/1.2))}><ZoomOut size={15}/></button><span>{zoomLabel}</span><button onClick={()=>setViewport(v=>zoomAt(v,{x:500,y:350},v.zoom*1.2))}><ZoomIn size={15}/></button></div></div><div className="canvas-stage" ref={stageRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={cancelDrag}>
        <div className="stage-grid"/><div className="artboard-shadow" style={{left:viewport.panX,top:viewport.panY,width:artboard.width*viewport.zoom,height:artboard.height*viewport.zoom}}/><SvgArtboard artboard={artboard} objects={doc.objects} viewport={viewport} previewTransforms={previewTransforms} selectionBounds={previewBounds} marquee={marquee}/>
        {!objects.length&&!drag&&<div className="welcome-hint">交互式选择与变换已接入<br/><span>先选择矩形或椭圆工具，在画板上拖拽绘制；再使用选择工具移动、缩放或旋转对象。</span></div>}
      </div></main>
      {rightOpen && <aside className="right-panel"><div className="panel-heading">属性</div>{selectionBounds?<div className="selection-info"><b>{selectedObjects.length} 个对象</b><span>X：{Math.round(selectionBounds.minX)} px</span><span>Y：{Math.round(selectionBounds.minY)} px</span><span>宽：{Math.round(selectionBounds.width)} px</span><span>高：{Math.round(selectionBounds.height)} px</span><small>拖动边角缩放，拖动顶部圆柄旋转；方向键微移，Shift + 方向键移动 10 px。</small></div>:<div className="empty-state">选择一个对象以编辑属性</div>}<div className="panel-heading">画板</div>{doc.artboards.map(item=><div className="layer-row" key={item.id}><span className="layer-icon">▧</span><span>{item.name}</span><small>{item.width} × {item.height}</small></div>)}<div className="panel-heading">图层 / 对象</div>{doc.layers.map(layer=><div key={layer.id}><div className="layer-row"><Layers3 size={15}/><span>{layer.name}</span><small>{layer.kind}</small></div>{layer.objectIds.map(id=>{const object=doc.objects[id];return object?<button className={selection.objectIds.includes(id)?'layer-row object-row selected':'layer-row object-row'} key={id} onClick={()=>setSelection({objectIds:selection.objectIds.includes(id)?selection.objectIds:[...selection.objectIds,id],activeObjectId:id,artboardId:artboard.id})}><span>◇</span><span>{object.name}</span><small>{object.kind}</small></button>:null;})}</div>)}</aside>}
    </div>
    <footer className="statusbar"><span>YGS v2 文档模型</span><span>SVG Renderer · 非 Canvas 2D</span><span>选择 / 多选 / 拖动 / 缩放 / 旋转 / 撤销重做</span><div><button onClick={()=>setLeftOpen(v=>!v)}><PanelLeft size={14}/></button><button onClick={()=>setRightOpen(v=>!v)}><PanelRight size={14}/></button></div></footer>
  </div>;
}
