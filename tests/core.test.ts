import { describe, expect, it } from 'vitest';
import { createDocument } from '../src/core/model';
import { createHistory, dispatch, redo, undo } from '../src/core/history';
import { screenToDocument, documentToScreen, zoomAt, panBy } from '../src/core/viewport';
import { getObjectBounds, hitTestObject, cubicPoint } from '../src/core/geometry';
import { emptySelection, selectObject, selectInRectangle } from '../src/core/selection';
import { createInteractiveTransform } from '../src/core/transform';
import { encodeYgs, decodeYgs } from '../src/persistence/ygs';
import { booleanPath } from '../src/core/pathBoolean';
import { applyProjective, invertProjective, projectiveFromRectToQuad, multiplyProjective } from '../src/core/projective';

describe('new YGS core foundation', () => {
  it('creates a v2 document with a real artboard and layer', () => {
    const doc = createDocument('test', 800, 600);
    expect(doc.magic).toBe('YGS2');
    expect(doc.schemaVersion).toBe(2);
    expect(doc.artboards[0].width).toBe(800);
    expect(doc.layers).toHaveLength(1);
  });
  it('keeps document-space and screen-space conversions inverse', () => {
    const viewport = { panX: 35, panY: 22, zoom: 1.5 };
    const p = { x: 120, y: 80 };
    expect(screenToDocument(documentToScreen(p, viewport), viewport)).toEqual(p);
    const zoomed = zoomAt(viewport, { x: 100, y: 100 }, 2);
    expect(zoomed.zoom).toBe(2);
    expect(documentToScreen(screenToDocument({x:100,y:100},viewport),zoomed)).toEqual({x:100,y:100});
  });
  it('pans in screen-space while preserving zoom', () => {
    expect(panBy({panX:10,panY:20,zoom:1.5},{x:-12,y:8})).toEqual({panX:-2,panY:28,zoom:1.5});
  });
  it('supports immutable history snapshots', () => {
    const initial = createDocument();
    const state = createHistory(initial);
    const artboard = { ...initial.artboards[0], id: 'artboard_2', name: '画板 2', x: 2000, layerIds: ['layer_2'] };
    const layer = { ...initial.layers[0], id: 'layer_2', objectIds: [] };
    const changed = dispatch(state, { type: 'artboard.add', artboard, layer });
    expect(changed.document.artboards).toHaveLength(2);
    expect(undo(changed).document.artboards).toHaveLength(1);
    expect(redo(undo(changed)).document.artboards).toHaveLength(2);
  });
});


describe('geometry and object selection services', () => {
  const rect = (id:string,x:number,y:number,w:number,h:number) => ({id,name:id,kind:'rect' as const,geometry:{x,y,width:w,height:h},transform:[1,0,0,1,0,0] as [number,number,number,number,number,number],opacity:1,visible:true,locked:false,layerId:'layer_1',fill:'#000',stroke:null,strokeWidth:0});
  it('computes transformed object bounds and performs hit testing', () => {
    const object=rect('a',10,20,100,50);
    expect(getObjectBounds(object)).toMatchObject({minX:10,minY:20,maxX:110,maxY:70});
    expect(hitTestObject(object,{x:50,y:40})).toBe(true);
    expect(hitTestObject(object,{x:200,y:200})).toBe(false);
  });
  it('evaluates cubic Bézier points', () => {
    expect(cubicPoint({x:0,y:0},{x:0,y:10},{x:10,y:10},{x:10,y:0},0.5)).toEqual({x:5,y:7.5});
  });
  it('maintains an additive selection set and selects objects inside a marquee', () => {
    const a=rect('a',0,0,20,20), b=rect('b',30,30,20,20);
    const one=selectObject(emptySelection(),'a');
    expect(selectObject(one,'b',{additive:true}).objectIds).toEqual(['a','b']);
    expect(selectInRectangle([a,b],{x:-1,y:-1},{x:25,y:25})).toEqual(['a']);
  });
  it('aligns objects through the document command and supports undo', () => {
    const initial=createDocument();
    const a={...rect('a',0,0,20,20),layerId:initial.layers[0].id}, b={...rect('b',50,40,10,10),layerId:initial.layers[0].id};
    const withA=dispatch(createHistory(initial),{type:'object.add',object:a});
    const withB=dispatch(withA,{type:'object.add',object:b});
    const aligned=dispatch(withB,{type:'object.align',ids:['a','b'],axis:'left'});
    expect(getObjectBounds(aligned.document.objects.b)!.minX).toBe(0);
    expect(undo(aligned).document.objects.b.transform[4]).toBe(0);
  });
});


describe('interactive transform command history', () => {
  it('applies a multi-object transform atomically and restores both objects on undo/redo', () => {
    const initial = createDocument();
    const makeRect = (id: string, x: number) => ({
      id, name: id, kind: 'rect' as const, geometry: { x, y: 10, width: 20, height: 20 },
      transform: [1, 0, 0, 1, 0, 0] as [number, number, number, number, number, number],
      opacity: 1, visible: true, locked: false, layerId: initial.layers[0].id,
      fill: '#000000', stroke: null, strokeWidth: 0,
    });
    let state = createHistory(initial);
    state = dispatch(state, { type: 'object.add', object: makeRect('one', 10) });
    state = dispatch(state, { type: 'object.add', object: makeRect('two', 50) });
    const moved = dispatch(state, { type: 'object.transform.batch', transforms: [
      { id: 'one', matrix: [1, 0, 0, 1, 15, 5] },
      { id: 'two', matrix: [1, 0, 0, 1, 15, 5] },
    ] });
    expect(moved.document.objects.one.transform[4]).toBe(15);
    expect(moved.document.objects.two.transform[5]).toBe(5);
    const restored = undo(moved);
    expect(restored.document.objects.one.transform[4]).toBe(0);
    expect(restored.document.objects.two.transform[5]).toBe(0);
    const replayed = redo(restored);
    expect(replayed.document.objects.one.transform[4]).toBe(15);
    expect(replayed.document.objects.two.transform[5]).toBe(5);
  });
});



describe('interactive transform geometry', () => {
  const bounds = { x: 0, y: 0, width: 100, height: 50, minX: 0, minY: 0, maxX: 100, maxY: 50 };
  it('translates a selected object from the gesture start', () => {
    expect(createInteractiveTransform([1,0,0,1,0,0], 'move', {x:5,y:8}, {x:25,y:18}, bounds)).toEqual([1,0,0,1,20,10]);
  });
  it('scales a group from the opposite corner', () => {
    expect(createInteractiveTransform([1,0,0,1,0,0], 'resize', {x:100,y:50}, {x:200,y:100}, bounds, 'se')).toEqual([2,0,0,2,0,0]);
  });
  it('rotates a group around its selection center', () => {
    const matrix=createInteractiveTransform([1,0,0,1,0,0], 'rotate', {x:100,y:25}, {x:50,y:75}, bounds, 'rotate');
    expect(matrix[0]).toBeCloseTo(0); expect(matrix[1]).toBeCloseTo(1);
    expect(matrix[2]).toBeCloseTo(-1); expect(matrix[3]).toBeCloseTo(0);
  });
});


describe('YGS transformed-object persistence', () => {
  it('preserves object transforms through checksum-verified save and reopen', async () => {
    const document = createDocument('persisted');
    const layerId = document.layers[0].id;
    const object = {
      id: 'persisted_rect', name: '矩形', kind: 'rect' as const,
      geometry: { x: 20, y: 30, width: 120, height: 80 },
      transform: [1.5, 0, 0, 1.5, 42, 18] as [number, number, number, number, number, number],
      opacity: 1, visible: true, locked: false, layerId, fill: '#ffffff', stroke: null, strokeWidth: 0,
    };
    document.objects[object.id] = object;
    document.layers[0].objectIds.push(object.id);
    const reopened = await decodeYgs(await encodeYgs(document));
    expect(reopened.objects.persisted_rect.transform).toEqual(object.transform);
  });
});


describe('even object distribution command', () => {
  const makeRect = (id: string, x: number, y: number, width: number, height: number, layerId: string) => ({
    id, name: id, kind: 'rect' as const, geometry: { x, y, width, height },
    transform: [1, 0, 0, 1, 0, 0] as [number, number, number, number, number, number],
    opacity: 1, visible: true, locked: false, layerId, fill: '#000000', stroke: null, strokeWidth: 0,
  });
  it('distributes unequal-width objects with equal horizontal gaps and supports undo/redo', () => {
    const initial = createDocument();
    let state = createHistory(initial);
    state = dispatch(state, { type: 'object.add', object: makeRect('a', 0, 0, 20, 10, initial.layers[0].id) });
    state = dispatch(state, { type: 'object.add', object: makeRect('b', 40, 0, 40, 10, initial.layers[0].id) });
    state = dispatch(state, { type: 'object.add', object: makeRect('c', 150, 0, 30, 10, initial.layers[0].id) });
    const distributed = dispatch(state, { type: 'object.distribute', ids: ['a', 'b', 'c'], axis: 'horizontal' });
    const bounds = ['a', 'b', 'c'].map(id => getObjectBounds(distributed.document.objects[id])!);
    expect(bounds[0].minX).toBe(0);
    expect(bounds[1].minX - bounds[0].maxX).toBeCloseTo(bounds[2].minX - bounds[1].maxX);
    expect(bounds[2].maxX).toBe(180);
    expect(undo(distributed).document.objects.b.transform[4]).toBe(0);
    expect(getObjectBounds(redo(undo(distributed)).document.objects.b)!.minX).toBeGreaterThan(0);
  });
  it('distributes objects vertically while preserving the outer bounds', () => {
    const initial = createDocument();
    let state = createHistory(initial);
    state = dispatch(state, { type: 'object.add', object: makeRect('top', 0, 0, 10, 20, initial.layers[0].id) });
    state = dispatch(state, { type: 'object.add', object: makeRect('middle', 0, 40, 10, 40, initial.layers[0].id) });
    state = dispatch(state, { type: 'object.add', object: makeRect('bottom', 0, 150, 10, 30, initial.layers[0].id) });
    const distributed = dispatch(state, { type: 'object.distribute', ids: ['top', 'middle', 'bottom'], axis: 'vertical' });
    const bounds = ['top', 'middle', 'bottom'].map(id => getObjectBounds(distributed.document.objects[id])!);
    expect(bounds[1].minY - bounds[0].maxY).toBeCloseTo(bounds[2].minY - bounds[1].maxY);
    expect(bounds[0].minY).toBe(0);
    expect(bounds[2].maxY).toBe(180);
  });
  it('rejects fewer than three objects', () => {
    const initial = createDocument();
    expect(() => dispatch(createHistory(initial), { type: 'object.distribute', ids: ['a', 'b'], axis: 'vertical' })).toThrow();
  });
});


describe('restored layer, guide and raster-result commands', () => {
  it('adds an AI raster result as one undoable independent layer', () => {
    const initial = createDocument('AI result', 800, 600);
    const layer = { id: 'ai_layer', name: 'AI 生成结果', visible: true, locked: false, opacity: 1, objectIds: [], parentId: null, blendMode: 'normal', kind: 'pixel' as const };
    const asset = { id: 'asset_1', mimeType: 'image/png', byteLength: 4, contentHash: 'test', storageKey: 'embedded:asset_1', width: 2, height: 2, dataUrl: 'data:image/png;base64,dGVzdA==' };
    const object = { id: 'image_1', name: 'AI 图像结果', kind: 'image' as const, assetId: asset.id, x: 0, y: 0, width: 2, height: 2, transform: [1,0,0,1,0,0] as [number,number,number,number,number,number], opacity: 1, visible: true, locked: false, layerId: layer.id };
    const added = dispatch(createHistory(initial), { type: 'ai.result.add', artboardId: initial.artboards[0].id, layer, asset, object });
    expect(added.document.layers).toHaveLength(2);
    expect(added.document.assets[asset.id].dataUrl).toBe(asset.dataUrl);
    expect(added.document.objects[object.id].kind).toBe('image');
    expect(layer.objectIds).toEqual([]);
    expect(undo(added).document.layers).toHaveLength(1);
  });
  it('stores guides in document history and toggles layer visibility', () => {
    const initial = createDocument();
    const guide = { id: 'guide_1', axis: 'x' as const, position: 240 };
    const withGuide = dispatch(createHistory(initial), { type: 'guide.add', guide });
    expect(withGuide.document.guides).toEqual([guide]);
    const cleared = dispatch(withGuide, { type: 'guide.clear' });
    expect(cleared.document.guides).toEqual([]);
    const hidden = dispatch(withGuide, { type: 'layer.update', id: initial.layers[0].id, patch: { visible: false } });
    expect(hidden.document.layers[0].visible).toBe(false);
    expect(undo(hidden).document.layers[0].visible).toBe(true);
  });
});


describe('editable convex vector pathfinder', () => {
  const makeRect=(id:string,x:number,y:number,w:number,h:number)=>({id,name:id,kind:'rect' as const,geometry:{x,y,width:w,height:h},transform:[1,0,0,1,0,0] as [number,number,number,number,number,number],opacity:1,visible:true,locked:false,layerId:'layer_1',fill:'#222',stroke:null,strokeWidth:0});
  const pathArea=(geometry:import('../src/core/model').VectorPath)=>{let area=0;for(let i=0;i<geometry.nodes.length;i++){const a=geometry.nodes[i].anchor,b=geometry.nodes[(i+1)%geometry.nodes.length].anchor;area+=a.x*b.y-b.x*a.y;}return Math.abs(area/2);};
  it('returns editable path geometry for union, subtract and intersection',()=>{
    const a=makeRect('a',0,0,100,100),b=makeRect('b',50,0,100,100);
    const union=booleanPath(a,b,'union');expect(union.nodes.length).toBe(8);
    const subtract=booleanPath(a,b,'subtract');expect(pathArea(subtract)).toBeCloseTo(5000);
    const intersect=booleanPath(a,b,'intersect');expect(pathArea(intersect)).toBeCloseTo(5000);
    const exclude=booleanPath(a,b,'exclude');expect(pathArea(exclude)).toBeCloseTo(10000);
  });
  it('rejects non-convex paths instead of silently generating incorrect geometry',()=>{
    const a=makeRect('a',0,0,10,10);const b={...makeRect('b',0,0,10,10),kind:'path' as const,geometry:{nodes:[{anchor:{x:0,y:0},inHandle:null,outHandle:null,kind:'corner' as const},{anchor:{x:10,y:0},inHandle:null,outHandle:null,kind:'corner' as const},{anchor:{x:5,y:5},inHandle:null,outHandle:null,kind:'corner' as const},{anchor:{x:10,y:10},inHandle:null,outHandle:null,kind:'corner' as const},{anchor:{x:0,y:10},inHandle:null,outHandle:null,kind:'corner' as const}],segments:[{type:'move' as const,to:0},{type:'line' as const,to:1},{type:'line' as const,to:2},{type:'line' as const,to:3},{type:'line' as const,to:4}],closed:true,fillRule:'nonzero' as const}};
    expect(()=>booleanPath(a,b,'intersect')).toThrow(/凸/);
  });
});


describe('object filters and adjustment layer history',()=>{
  it('updates vector object style and restores it with undo',()=>{
    const initial=createDocument();const layerId=initial.layers[0].id;const object={id:'filtered',name:'rect',kind:'rect' as const,geometry:{x:0,y:0,width:20,height:20},transform:[1,0,0,1,0,0] as [number,number,number,number,number,number],opacity:1,visible:true,locked:false,layerId,fill:'#000',stroke:null,strokeWidth:0};
    const added=dispatch(createHistory(initial),{type:'object.add',object});const filtered=dispatch(added,{type:'object.update',id:object.id,patch:{filter:{kind:'gaussian-blur',amount:4}}});expect((filtered.document.objects.filtered as import('../src/core/model').VectorObject).filter?.amount).toBe(4);expect(undo(filtered).document.objects.filtered).toEqual(object);
  });
  it('adds and updates an adjustment layer through document history',()=>{
    const initial=createDocument(),layerId='adjustment_1',adjustment={id:'brightness_1',kind:'brightness-contrast' as const,enabled:true,opacity:1,parameters:{brightness:0,contrast:0},maskAssetId:null};const layer={id:layerId,name:'调整图层',visible:true,locked:false,opacity:1,objectIds:[],parentId:null,blendMode:'normal',kind:'adjustment' as const};
    const withLayer=dispatch(createHistory(initial),{type:'layer.add',layer,artboardId:initial.artboards[0].id});const withAdjustment=dispatch(withLayer,{type:'adjustment.add',layerId,adjustment});const changed=dispatch(withAdjustment,{type:'adjustment.update',layerId,adjustmentId:adjustment.id,patch:{parameters:{brightness:20,contrast:15}}});expect(changed.document.adjustments[layerId][0].parameters.brightness).toBe(20);expect(undo(changed).document.adjustments[layerId][0].parameters.brightness).toBe(0);
  });
});

describe('SVG vector brush, eraser mask and text style persistence',()=>{
  it('round-trips Bézier handles, eraser composite mode and editable font attributes',async()=>{
    const document=createDocument('tool persistence'),layerId=document.layers[0].id;
    const path={id:'eraser_path',name:'eraser',kind:'path' as const,geometry:{nodes:[{anchor:{x:0,y:0},inHandle:null,outHandle:{x:10,y:0},kind:'symmetric' as const},{anchor:{x:20,y:0},inHandle:{x:10,y:0},outHandle:null,kind:'symmetric' as const}],segments:[{type:'move' as const,to:0},{type:'cubic' as const,from:0,to:1}],closed:false,fillRule:'nonzero' as const},transform:[1,0,0,1,0,0] as [number,number,number,number,number,number],opacity:1,visible:true,locked:false,layerId,fill:null,stroke:'#000',strokeWidth:18,compositeMode:'erase' as const};
    const text={id:'styled_text',name:'styled',kind:'text' as const,geometry:{x:5,y:8,text:'YutuGs',fontSize:42,fontFamily:'Microsoft YaHei',fontWeight:'700',fontStyle:'italic'},transform:[1,0,0,1,0,0] as [number,number,number,number,number,number],opacity:1,visible:true,locked:false,layerId,fill:'#123456',stroke:null,strokeWidth:0};
    document.objects[path.id]=path;document.objects[text.id]=text;document.layers[0].objectIds.push(path.id,text.id);
    const reopened=await decodeYgs(await encodeYgs(document));
    expect((reopened.objects.eraser_path as import('../src/core/model').VectorObject).compositeMode).toBe('erase');
    expect(((reopened.objects.eraser_path as import('../src/core/model').VectorObject).geometry as import('../src/core/model').VectorPath).nodes[0].outHandle).toEqual({x:10,y:0});
    expect((reopened.objects.styled_text as import('../src/core/model').VectorObject).geometry).toMatchObject({fontFamily:'Microsoft YaHei',fontWeight:'700',fontStyle:'italic'});
  });
});


describe('projective transform geometry', () => {
  it('maps a rectangle to a perspective quadrilateral and inverts the mapping', () => {
    const bounds = { x: 0, y: 0, width: 100, height: 60, minX: 0, minY: 0, maxX: 100, maxY: 60 };
    const quad = [{x:8,y:4},{x:118,y:12},{x:96,y:78},{x:-4,y:58}] as const;
    const matrix = projectiveFromRectToQuad(bounds, quad as any);
    const source = [{x:0,y:0},{x:100,y:0},{x:100,y:60},{x:0,y:60}];
    source.forEach((point,index) => {
      const mapped = applyProjective(point,matrix);
      expect(mapped.x).toBeCloseTo(quad[index].x,5);
      expect(mapped.y).toBeCloseTo(quad[index].y,5);
      const restored = applyProjective(mapped,invertProjective(matrix));
      expect(restored.x).toBeCloseTo(point.x,5);
      expect(restored.y).toBeCloseTo(point.y,5);
    });
  });
  it('composes projective transforms in order', () => {
    const bounds = { x: 0, y: 0, width: 10, height: 10, minX: 0, minY: 0, maxX: 10, maxY: 10 };
    const first = projectiveFromRectToQuad(bounds,[{x:1,y:1},{x:12,y:0},{x:11,y:12},{x:0,y:10}]);
    const second = projectiveFromRectToQuad(bounds,[{x:5,y:2},{x:15,y:3},{x:13,y:15},{x:4,y:13}]);
    const point = {x:4,y:6};
    const sequential = applyProjective(applyProjective(point,first),second);
    const composed = applyProjective(point,multiplyProjective(second,first));
    expect(composed.x).toBeCloseTo(sequential.x,6);
    expect(composed.y).toBeCloseTo(sequential.y,6);
  });
});


describe('projective object history and YGS persistence', () => {
  it('stores projective transforms as undoable document edits', async () => {
    const doc = createDocument('perspective');
    const layerId = doc.layers[0].id;
    const object = { id: 'projective_rect', name: '透视矩形', kind: 'rect' as const, geometry: {x:0,y:0,width:100,height:60}, transform: [1,0,0,1,0,0] as [number,number,number,number,number,number], opacity:1,visible:true,locked:false,layerId,fill:'#fff',stroke:null,strokeWidth:0 };
    let state = dispatch(createHistory(doc), {type:'object.add',object});
    const matrix = projectiveFromRectToQuad({x:0,y:0,width:100,height:60,minX:0,minY:0,maxX:100,maxY:60},[{x:10,y:5},{x:110,y:0},{x:90,y:70},{x:0,y:60}]);
    state = dispatch(state,{type:'object.projective.batch',transforms:[{id:object.id,matrix}]});
    expect(state.document.objects[object.id].projectiveTransform).toEqual(matrix);
    const reopened = await decodeYgs(await encodeYgs(state.document));
    expect(reopened.objects[object.id].projectiveTransform).toEqual(matrix);
    expect(undo(state).document.objects[object.id].projectiveTransform).toBeUndefined();
  });
});

describe('document ICC color-management metadata', () => {
  it('stores output profile identity and print settings in YGS history', async () => {
    const initial = createDocument('print-ready');
    expect(initial.colorManagement?.workingRgbProfile).toContain('sRGB');
    const updated = dispatch(createHistory(initial), { type: 'document.colorManagement.update', patch: {
      outputCmykProfile: { name: 'Printer Coated Profile', sha256: 'a'.repeat(64) },
      renderingIntent: 'perceptual', blackPointCompensation: false, totalInkLimit: 280,
    }});
    expect(updated.document.colorManagement?.outputCmykProfile?.sha256).toBe('a'.repeat(64));
    const reopened = await decodeYgs(await encodeYgs(updated.document));
    expect(reopened.colorManagement?.totalInkLimit).toBe(280);
    expect(undo(updated).document.colorManagement?.outputCmykProfile).toBeNull();
  });
});


describe('Photoshop / Illustrator document setup metadata',()=>{
  it('persists distinct image and illustration setup options in YGS v2',async()=>{
    const document=createDocument('print layout',2480,3508);
    document.units='mm';document.colorMode='CMYK';document.resolutionDpi=300;
    document.documentSetup={applicationMode:'illustration',presetCategory:'Print',orientation:'portrait',bitDepth:8,pixelAspectRatio:'square',colorProfileName:'FOGRA39L (user supplied)',artboardColumns:2,artboardSpacing:40,bleedMm:{top:3,right:3,bottom:3,left:3},rasterEffectsPpi:300,previewMode:'overprint',alignNewObjectsToPixelGrid:false};
    const reopened=await decodeYgs(await encodeYgs(document));
    expect(reopened.documentSetup).toMatchObject({applicationMode:'illustration',presetCategory:'Print',orientation:'portrait',bleedMm:{top:3,right:3,bottom:3,left:3},rasterEffectsPpi:300,previewMode:'overprint'});
    expect(reopened.colorMode).toBe('CMYK');expect(reopened.units).toBe('mm');
  });
});


describe('layer stack ordering', () => {
  it('reorders layers within their artboard and supports undo/redo', () => {
    const document = createDocument('layer order');
    const artboard = document.artboards[0];
    const baseLayer = document.layers[0];
    const upperLayer = { ...baseLayer, id: 'layer_upper', name: '上层', objectIds: [] };
    const topLayer = { ...baseLayer, id: 'layer_top', name: '顶层', objectIds: [] };
    document.layers.push(upperLayer, topLayer);
    artboard.layerIds.push(upperLayer.id, topLayer.id);

    const initial = createHistory(document);
    const reordered = dispatch(initial, { type: 'layer.reorder', id: upperLayer.id, artboardId: artboard.id, toIndex: 2 });
    expect(reordered.document.artboards[0].layerIds).toEqual([baseLayer.id, topLayer.id, upperLayer.id]);
    expect(undo(reordered).document.artboards[0].layerIds).toEqual([baseLayer.id, upperLayer.id, topLayer.id]);
    expect(redo(undo(reordered)).document.artboards[0].layerIds).toEqual([baseLayer.id, topLayer.id, upperLayer.id]);
  });

  it('rejects layers from another artboard and invalid target indexes', () => {
    const document = createDocument('layer order validation');
    const otherLayer = { ...document.layers[0], id: 'other_layer', objectIds: [] };
    const otherArtboard = { ...document.artboards[0], id: 'other_artboard', layerIds: [otherLayer.id] };
    document.layers.push(otherLayer);
    document.artboards.push(otherArtboard);
    const history = createHistory(document);
    expect(() => dispatch(history, { type: 'layer.reorder', id: otherLayer.id, artboardId: document.artboards[0].id, toIndex: 0 })).toThrow();
    expect(() => dispatch(history, { type: 'layer.reorder', id: document.layers[0].id, artboardId: document.artboards[0].id, toIndex: 1 })).toThrow();
  });
});
