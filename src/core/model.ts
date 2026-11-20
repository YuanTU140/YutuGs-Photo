/** Canonical YGS v2 document model. Coordinates are document-space CSS pixels. */
export type Id = string;
export type Point = { x: number; y: number };
export type Matrix = [number, number, number, number, number, number];
export type Color = string;
export type PathNode = {
  anchor: Point;
  inHandle: Point | null;
  outHandle: Point | null;
  kind: 'corner' | 'smooth' | 'symmetric';
};
export type PathSegment =
  | { type: 'move'; to: number }
  | { type: 'line'; to: number }
  | { type: 'cubic'; to: number; from: number }
  | { type: 'quadratic'; to: number; control: Point };
export type VectorPath = {
  nodes: PathNode[];
  segments: PathSegment[];
  closed: boolean;
  fillRule: 'nonzero' | 'evenodd';
};
export type BaseObject = { id: Id; name: string; transform: Matrix; opacity: number; visible: boolean; locked: boolean; layerId: Id };
export type VectorObject = BaseObject & {
  kind: 'path' | 'rect' | 'ellipse' | 'text';
  geometry: VectorPath | { x: number; y: number; width: number; height: number } | { x: number; y: number; text: string; fontSize: number; fontFamily: string; fontWeight?: string; fontStyle?: string };
  fill: Color | null; stroke: Color | null; strokeWidth: number;
  compositeMode?: 'normal' | 'erase';
  filter?: { kind: 'gaussian-blur' | 'brightness' | 'hue-rotate'; amount: number } | null;
};
export type RasterObject = BaseObject & { kind: 'image'; assetId: Id; x: number; y: number; width: number; height: number };
export type EditorObject = VectorObject | RasterObject;
export type Layer = { id: Id; name: string; visible: boolean; locked: boolean; opacity: number; objectIds: Id[]; parentId: Id | null; blendMode: string; kind: 'pixel' | 'vector' | 'adjustment' | 'group' };
export type Artboard = { id: Id; name: string; x: number; y: number; width: number; height: number; background: Color | 'transparent'; layerIds: Id[] };
export type Guide = { id: Id; axis: 'x' | 'y'; position: number };
export type RasterAsset = { id: Id; mimeType: string; byteLength: number; contentHash: string; storageKey: string; width: number; height: number; dataUrl?: string };
export type Adjustment = { id: Id; kind: 'levels' | 'curves' | 'hue-saturation' | 'brightness-contrast' | 'gaussian-blur'; enabled: boolean; opacity: number; parameters: Record<string, number | number[]>; maskAssetId: Id | null };
export type YgsDocument = {
  magic: 'YGS2'; schemaVersion: 2; appVersion: string; id: Id; name: string;
  units: 'px' | 'mm' | 'cm' | 'in' | 'pt'; resolutionDpi: number; colorMode: 'RGB' | 'CMYK' | 'Grayscale';
  artboards: Artboard[]; layers: Layer[]; objects: Record<Id, EditorObject>; assets: Record<Id, RasterAsset>;
  guides?: Guide[];
  packaging?: { bagType: string; capacity?: string; widthCm: number; heightCm: number; leftMFoldCm: number; rightMFoldCm: number; bleedMm: number };
  adjustments: Record<Id, Adjustment[]>; metadata: { createdAt: string; modifiedAt: string };
};
export type SelectionState = { objectIds: Id[]; activeObjectId: Id | null; artboardId: Id | null };
export const identityMatrix = (): Matrix => [1, 0, 0, 1, 0, 0];
export const createId = (prefix = 'id'): Id => `${prefix}_${crypto.randomUUID()}`;
export function createDocument(name = '未命名设计', width = 1920, height = 1080): YgsDocument {
  const now = new Date().toISOString();
  const artboardId = createId('artboard');
  const layerId = createId('layer');
  return {
    magic: 'YGS2', schemaVersion: 2, appVersion: '1.1.3-alpha', id: createId('doc'), name,
    units: 'px', resolutionDpi: 300, colorMode: 'RGB',
    artboards: [{ id: artboardId, name: '画板 1', x: 0, y: 0, width, height, background: '#ffffff', layerIds: [layerId] }],
    layers: [{ id: layerId, name: '图层 1', visible: true, locked: false, opacity: 1, objectIds: [], parentId: null, blendMode: 'normal', kind: 'vector' }],
    objects: {}, assets: {}, guides: [], adjustments: {}, metadata: { createdAt: now, modifiedAt: now },
  };
}
