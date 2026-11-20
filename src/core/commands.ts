import type { Artboard, EditorObject, Id, Layer, YgsDocument } from './model';
import { alignedTransform, unionBounds, getObjectBounds, type AlignAxis } from './geometry';

export type EditorCommand =
  | { type: 'object.add'; object: EditorObject }
  | { type: 'object.delete'; ids: Id[] }
  | { type: 'object.transform'; id: Id; matrix: EditorObject['transform'] }
  | { type: 'object.transform.batch'; transforms: Array<{ id: Id; matrix: EditorObject['transform'] }> }
  | { type: 'object.align'; ids: Id[]; axis: AlignAxis; relativeTo?: 'selection' | Id }
  | { type: 'artboard.add'; artboard: Artboard; layer: Layer }
  | { type: 'artboard.resize'; id: Id; width: number; height: number };

export function reduceDocument(doc: YgsDocument, command: EditorCommand): YgsDocument {
  const next = structuredClone(doc);
  switch (command.type) {
    case 'object.add': {
      next.objects[command.object.id] = command.object;
      const layer = next.layers.find((item) => item.id === command.object.layerId);
      if (!layer) throw new Error(`Layer not found: ${command.object.layerId}`);
      layer.objectIds.push(command.object.id);
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
      for (const object of selected) object.transform = alignedTransform(object, target, command.axis);
      break;
    }
    case 'artboard.add':
      next.artboards.push(command.artboard);
      next.layers.push(command.layer);
      break;
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
