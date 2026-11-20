import { describe, expect, it } from 'vitest';
import { createDocument } from '../src/core/model';
import { createHistory, dispatch, redo, undo } from '../src/core/history';
import { screenToDocument, documentToScreen, zoomAt } from '../src/core/viewport';

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
    expect(zoomAt(viewport, { x: 100, y: 100 }, 2).zoom).toBe(2);
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

import { getObjectBounds, hitTestObject, cubicPoint } from '../src/core/geometry';
import { emptySelection, selectObject, selectInRectangle } from '../src/core/selection';

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


import { createInteractiveTransform } from '../src/core/transform';

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

import { encodeYgs, decodeYgs } from '../src/persistence/ygs';

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
