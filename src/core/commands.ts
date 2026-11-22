import type { Artboard, EditorObject, Id, Layer, RasterAsset, Guide, YgsDocument } from './model';
import { alignedTransform, unionBounds, getObjectBounds, type AlignAxis } from './geometry';
import { affineToProjective, multiplyProjective, invertProjective, identityProjective } from './projective';

export type EditorCommand =
  | { type: 'object.add'; object: EditorObject }
  | { type: 'object.delete'; ids: Id[] }
  | { type: 'object.update'; id: Id; patch: Partial<Pick<import('./model').VectorObject, 'geometry'|'fill'|'stroke'|'strokeWidth'|'opacity'|'name'|'filter'|'compositeMode'|'spotInkId'>> }
  | { type: 'object.update.batch'; patches: Array<{ id: Id; patch: Partial<EditorObject> & { spotInkId?: Id | null } }> }
  | { type: 'object.reorder'; id: Id; direction: 'up' | 'down' }
  | { type: 'adjustment.add'; layerId: Id; adjustment: import('./model').Adjustment }
  | { type: 'adjustment.update'; layerId: Id; adjustmentId: Id; patch: Partial<Pick<import('./model').Adjustment, 'enabled'|'opacity'|'parameters'>> }
  | { type: 'document.colorManagement.update'; patch: Partial<import('./model').ColorManagementSettings> }
  | { type: 'document.spotInks.update'; spotInks: import('./model').SpotInk[] }
  | { type: 'object.transform'; id: Id; matrix: EditorObject['transform'] }
  | { type: 'object.transform.batch'; transforms: Array<{ id: Id; matrix: EditorObject['transform'] }> }
  | { type: 'object.projective.batch'; transforms: Array<{ id: Id; matrix: NonNullable<EditorObject['projectiveTransform']> }> }
  | { type: 'object.align'; ids: Id[]; axis: AlignAxis; relativeTo?: 'selection' | Id }
  | { type: 'object.distribute'; ids: Id[]; axis: 'horizontal' | 'vertical' }
  | { type: 'ai.result.add'; artboardId: Id; layer: Layer; asset: RasterAsset; object: EditorObject }
  | { type: 'asset.add'; asset: RasterAsset }
  | { type: 'guide.add'; guide: Guide }
  | { type: 'guide.update'; id: Id; patch: Partial<Pick<Guide, 'position'|'locked'|'visible'|'color'>> }
  | { type: 'guide.delete'; id: Id }
  | { type: 'guide.clear' }
  | { type: 'layer.add'; layer: Layer; artboardId: Id }
  | { type: 'layer.update'; id: Id; patch: Partial<Pick<Layer, 'name'|'visible'|'locked'|'opacity'|'blendMode'>> }
  | { type: 'layer.reorder'; id: Id; artboardId: Id; toIndex: number }
  | { type: 'layer.delete'; id: Id }
  | { type: 'artboard.add'; artboard: Artboard; layer: Layer }
  | { type: 'artboard.resize'; id: Id; width: number; height: number };

export function reduceDocument(doc: YgsDocument, command: EditorCommand): YgsDocument {
  const next = structuredClone(doc);
  switch (command.type) {
    case 'object.add': {
      const addedObject = structuredClone(command.object);
      next.objects[addedObject.id] = addedObject;
      const layer = next.layers.find((item) => item.id === addedObject.layerId);
      if (!layer) throw new Error(`Layer not found: ${command.object.layerId}`);
      layer.objectIds.push(addedObject.id);
      break;
    }
    case 'object.update.batch': { for (const item of command.patches) { const object = next.objects[item.id]; if (object) Object.assign(object, structuredClone(item.patch)); } break; }
    case 'object.reorder': { const object = next.objects[command.id]; if (!object) break; const layer = next.layers.find(item => item.id === object.layerId); if (!layer) break; const index = layer.objectIds.indexOf(object.id); const target = index + (command.direction === 'up' ? 1 : -1); if (index >= 0 && target >= 0 && target < layer.objectIds.length) { [layer.objectIds[index], layer.objectIds[target]] = [layer.objectIds[target], layer.objectIds[index]]; } break; }
    case 'object.update': {
      const object = next.objects[command.id];
      if (!object || object.kind === 'image') throw new Error(`Vector object not found: ${command.id}`);
      Object.assign(object, structuredClone(command.patch));
      break;
    }
    case 'adjustment.add': {
      if (!next.layers.some(layer => layer.id === command.layerId)) throw new Error(`Layer not found: ${command.layerId}`);
      next.adjustments[command.layerId] = [...(next.adjustments[command.layerId] ?? []), structuredClone(command.adjustment)];
      break;
    }
    case 'document.spotInks.update': { next.spotInks = structuredClone(command.spotInks); break; }
    case 'document.colorManagement.update': {
      next.colorManagement = { workingRgbProfile: 'sRGB IEC61966-2.1', outputCmykProfile: null, renderingIntent: 'relative-colorimetric', blackPointCompensation: true, totalInkLimit: 300, ...(next.colorManagement ?? {}), ...structuredClone(command.patch) };
      break;
    }
    case 'adjustment.update': {
      const list = next.adjustments[command.layerId] ?? [];
      const item = list.find(value => value.id === command.adjustmentId);
      if (!item) throw new Error(`Adjustment not found: ${command.adjustmentId}`);
      Object.assign(item, structuredClone(command.patch));
      break;
    }
    case 'object.delete': {
      for (const id of command.ids) {
        const object = next.objects[id];
        if (!object) continue;
        const layer = next.layers.find((item) => item.id === object.layerId);
        if (layer) layer.objectIds = layer.objectIds.filter((item) => item !== id);
        delete next.objects[id];
      }
      break;
    }
    case 'object.transform': {
      const object = next.objects[command.id];
      if (!object) throw new Error(`Object not found: ${command.id}`);
      object.transform = command.matrix;
      break;
    }
    case 'object.transform.batch': {
      for (const item of command.transforms) {
        const object = next.objects[item.id];
        if (!object) throw new Error(`Object not found: ${item.id}`);
        object.transform = item.matrix;
      }
      break;
    }
    case 'object.projective.batch': {
      for (const item of command.transforms) {
        const object = next.objects[item.id];
        if (!object) throw new Error(`Object not found: ${item.id}`);
        if (!item.matrix.every(Number.isFinite)) throw new Error('Projective matrix contains non-finite values');
        invertProjective(item.matrix);
        object.projectiveTransform = [...item.matrix] as NonNullable<EditorObject['projectiveTransform']>;
      }
      break;
    }
    case 'object.align': {
      if (command.ids.length < (command.relativeTo ? 1 : 2)) throw new Error('Selection is too small for this alignment operation');
      const selected = command.ids.map(id => next.objects[id]).filter((item): item is EditorObject => Boolean(item));
      if (selected.length !== command.ids.length) throw new Error('One or more selected objects do not exist');
      const referenceObject = command.relativeTo && command.relativeTo !== 'selection' ? next.objects[command.relativeTo] : undefined;
      if (command.relativeTo && command.relativeTo !== 'selection' && !referenceObject) throw new Error(`Reference object not found: ${command.relativeTo}`);
      const target = referenceObject
        ? getObjectBounds(referenceObject)
        : unionBounds(selected.map(getObjectBounds).filter((b): b is NonNullable<typeof b> => Boolean(b)));
      if (!target) throw new Error('Selected objects have no measurable geometry');
      for (const object of selected) { const aligned=alignedTransform(object,target,command.axis); const dx=aligned[4]-object.transform[4],dy=aligned[5]-object.transform[5]; object.projectiveTransform=multiplyProjective(affineToProjective([1,0,0,1,dx,dy]),object.projectiveTransform??identityProjective()); }
      break;
    }
    case 'object.distribute': {
      if (command.ids.length < 3) throw new Error('At least three objects are required for distribution');
      const selected = command.ids.map(id => next.objects[id]);
      if (selected.some(item => !item)) throw new Error('One or more selected objects do not exist');
      const objects = selected as EditorObject[];
      const measured = objects.map(object => ({ object, bounds: getObjectBounds(object) }));
      if (measured.some(item => !item.bounds)) throw new Error('Selected objects have no measurable geometry');
      const horizontal = command.axis === 'horizontal';
      measured.sort((a, b) => horizontal
        ? a.bounds!.minX - b.bounds!.minX
        : a.bounds!.minY - b.bounds!.minY);
      const first = measured[0].bounds!;
      const last = measured[measured.length - 1].bounds!;
      const totalSize = measured.reduce((sum, item) => sum + (horizontal ? item.bounds!.width : item.bounds!.height), 0);
      const gap = ((horizontal ? last.maxX - first.minX : last.maxY - first.minY) - totalSize) / (measured.length - 1);
      if (!Number.isFinite(gap)) throw new Error('Unable to calculate distribution spacing');
      let cursor = horizontal ? first.minX : first.minY;
      for (const item of measured) {
        const bounds = item.bounds!;
        const currentStart = horizontal ? bounds.minX : bounds.minY;
        const delta = cursor - currentStart;

        const translation:import('./model').Matrix=horizontal?[1,0,0,1,delta,0]:[1,0,0,1,0,delta];item.object.projectiveTransform=multiplyProjective(affineToProjective(translation),item.object.projectiveTransform??identityProjective());
        cursor += (horizontal ? bounds.width : bounds.height) + gap;
      }
      break;
    }
    case 'ai.result.add': {
      const artboard = next.artboards.find(item => item.id === command.artboardId);
      if (!artboard) throw new Error(`Artboard not found: ${command.artboardId}`);
      if (command.object.kind !== 'image' || command.object.layerId !== command.layer.id || command.object.assetId !== command.asset.id) throw new Error('AI raster result references are inconsistent');
      const addedLayer = structuredClone(command.layer);
      const addedAsset = structuredClone(command.asset);
      const addedObject = structuredClone(command.object);
      addedLayer.objectIds.push(addedObject.id);
      next.layers.push(addedLayer); artboard.layerIds.push(addedLayer.id);
      next.assets[addedAsset.id] = addedAsset; next.objects[addedObject.id] = addedObject;
      break;
    }
    case 'asset.add': { const asset = structuredClone(command.asset); next.assets[asset.id] = asset; break; }
    case 'guide.add': { next.guides = [...(next.guides ?? []), structuredClone(command.guide)]; break; }
    case 'guide.update': { next.guides = (next.guides ?? []).map(item => item.id === command.id ? { ...item, ...structuredClone(command.patch) } : item); break; }
    case 'guide.delete': { next.guides = (next.guides ?? []).filter(item => item.id !== command.id); break; }
    case 'guide.clear': { next.guides = []; break; }
    case 'layer.add': {
      const artboard = next.artboards.find(item => item.id === command.artboardId);
      if (!artboard) throw new Error(`Artboard not found: ${command.artboardId}`);
      const layer = structuredClone(command.layer);
      next.layers.push(layer); artboard.layerIds.push(layer.id);
      break;
    }
    case 'layer.update': {
      const layer = next.layers.find(item => item.id === command.id);
      if (!layer) throw new Error(`Layer not found: ${command.id}`);
      Object.assign(layer, command.patch);
      break;
    }
    case 'layer.reorder': {
      const artboard = next.artboards.find(item => item.id === command.artboardId);
      if (!artboard) throw new Error(`Artboard not found: ${command.artboardId}`);
      const fromIndex = artboard.layerIds.indexOf(command.id);
      if (fromIndex < 0) throw new Error(`Layer ${command.id} does not belong to artboard ${command.artboardId}`);
      if (!Number.isInteger(command.toIndex) || command.toIndex < 0 || command.toIndex >= artboard.layerIds.length) throw new Error('Layer target index is out of range');
      const [movedId] = artboard.layerIds.splice(fromIndex, 1);
      artboard.layerIds.splice(command.toIndex, 0, movedId);
      break;
    }
    case 'layer.delete': {
      const layer = next.layers.find(item => item.id === command.id);
      if (!layer) break;
      if (layer.objectIds.length) throw new Error('请先移动或删除图层中的对象');
      next.layers = next.layers.filter(item => item.id !== command.id);
      for (const artboard of next.artboards) artboard.layerIds = artboard.layerIds.filter(id => id !== command.id);
      break;
    }
    case 'artboard.add': {
      const artboard = structuredClone(command.artboard);
      const layer = structuredClone(command.layer);
      next.artboards.push(artboard);
      next.layers.push(layer);
      break;
    }
    case 'artboard.resize': {
      const artboard = next.artboards.find((item) => item.id === command.id);
      if (!artboard) throw new Error(`Artboard not found: ${command.id}`);
      if (command.width <= 0 || command.height <= 0) throw new Error('Artboard dimensions must be positive');
      artboard.width = command.width; artboard.height = command.height;
      break;
    }
  }
  next.metadata.modifiedAt = new Date().toISOString();
  return next;
}
