import { createDocument, createId, identityMatrix, type EditorObject, type PathNode, type PathSegment, type VectorObject, type VectorPath } from '../core/model';

const number = (value: string | null, fallback = 0) => {
  const parsed = value === null ? NaN : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const style = (element: Element, key: string, fallback: string) => {
  const inline = (element.getAttribute('style') ?? '').split(';').map(part => part.trim()).find(part => part.startsWith(`${key}:`));
  return inline ? inline.slice(key.length + 1).trim() : element.getAttribute(key) ?? fallback;
};

function parsePathData(data: string): VectorPath | null {
  const tokens = data.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g) ?? [];
  const nodes: PathNode[] = [];
  const segments: PathSegment[] = [];
  let index = 0, command = '', current = { x: 0, y: 0 }, start = { x: 0, y: 0 }, startNode = -1, previousNode = -1;
  const isCommand = (token: string) => /^[a-zA-Z]$/.test(token);
  const read = () => { const token = tokens[index++]; const value = Number(token); if (!Number.isFinite(value)) throw new Error('SVG path 参数无效'); return value; };
  const addNode = (point: {x:number;y:number}, kind: PathNode['kind'] = 'corner') => { nodes.push({ anchor: point, inHandle: null, outHandle: null, kind }); return nodes.length - 1; };
  try {
    while (index < tokens.length) {
      if (isCommand(tokens[index])) command = tokens[index++];
      if (!command) return null;
      const relative = command === command.toLowerCase();
      const upper = command.toUpperCase();
      if (upper === 'Z') {
        if (startNode < 0) return null; segments.push({ type: 'line', to: startNode });
        current = { ...start }; command = ''; continue;
      }
      if (upper === 'M' || upper === 'L') {
        const x = read(), y = read(), point = relative ? { x: current.x + x, y: current.y + y } : { x, y };
        const node = addNode(point);
        if (upper === 'M') { segments.push({ type: 'move', to: node }); start = { ...point }; startNode = node; command = relative ? 'l' : 'L'; }
        else segments.push({ type: 'line', to: node });
        current = point; previousNode = node;
      } else if (upper === 'H' || upper === 'V') {
        const value = read(); const point = { x: upper === 'H' ? (relative ? current.x + value : value) : current.x, y: upper === 'V' ? (relative ? current.y + value : value) : current.y };
        const node = addNode(point); segments.push({ type: 'line', to: node }); current = point; previousNode = node;
      } else if (upper === 'C') {
        const vals = [read(), read(), read(), read(), read(), read()];
        const p = (x:number,y:number) => relative ? { x: current.x + x, y: current.y + y } : { x, y };
        const c1 = p(vals[0], vals[1]), c2 = p(vals[2], vals[3]), end = p(vals[4], vals[5]);
        if (previousNode < 0) return null;
        nodes[previousNode].outHandle = c1;
        const node = addNode(end); nodes[node].inHandle = c2;
        segments.push({ type: 'cubic', from: previousNode, to: node }); current = end; previousNode = node;
      } else if (upper === 'Q') {
        const vals = [read(), read(), read(), read()];
        const p = (x:number,y:number) => relative ? { x: current.x + x, y: current.y + y } : { x, y };
        const control = p(vals[0], vals[1]), end = p(vals[2], vals[3]), node = addNode(end);
        segments.push({ type: 'quadratic', to: node, control }); current = end; previousNode = node;
      } else return null;
    }
  } catch { return null; }
  if (!nodes.length || !segments.length) return null;
  const closed = /z\s*$/i.test(data.trim());
  return { nodes, segments, closed, fillRule: 'nonzero' };
}

export function importSvgText(source: string, filename: string) {
  const xml = new DOMParser().parseFromString(source, 'image/svg+xml');
  if (xml.querySelector('parsererror') || xml.documentElement.localName.toLowerCase() !== 'svg') throw new Error('SVG 文件无效');
  const root = xml.documentElement;
  const viewBox = (root.getAttribute('viewBox') ?? '').trim().split(/[\s,]+/).map(Number);
  const width = number(root.getAttribute('width'), viewBox.length === 4 ? viewBox[2] : 1200);
  const height = number(root.getAttribute('height'), viewBox.length === 4 ? viewBox[3] : 800);
  if (!(width > 0 && height > 0 && width <= 30000 && height <= 30000)) throw new Error('SVG 画布尺寸无效或超过 30000 px');
  const doc = createDocument(filename.replace(/\.[^.]+$/, ''), Math.round(width), Math.round(height));
  const layer = doc.layers[0];
  const warnings: string[] = [];
  if (root.querySelector('style')) warnings.push('SVG CSS 样式表尚未完整解析，仅读取基础 presentation attributes。');
  const add = (element: Element, kind: VectorObject['kind'], geometry: VectorObject['geometry'], fill: string | null, stroke: string | null, strokeWidth: number) => {
    const object: EditorObject = { id: createId('object'), name: `${kind} ${layer.objectIds.length + 1}`, kind, geometry, transform: identityMatrix(), opacity: Math.max(0, Math.min(1, number(element.getAttribute('opacity'), 1))), visible: style(element, 'display', 'inline') !== 'none', locked: false, layerId: layer.id, fill, stroke, strokeWidth } as VectorObject;
    doc.objects[object.id] = object; layer.objectIds.push(object.id);
  };
  const visit = (element: Element) => {
    const tag = element.localName.toLowerCase();
    if (tag === 'g' || tag === 'a' || tag === 'svg') { if (element.hasAttribute('transform')) warnings.push('SVG 分组变换尚未完整映射，已保留子对象的基础几何。'); if (element.hasAttribute('opacity')) warnings.push('SVG 分组透明度尚未向子对象继承。'); Array.from(element.children).forEach(visit); return; }
    const fillValue = style(element, 'fill', '#000000');
    const fill = fillValue === 'none' || fillValue.startsWith('url(') ? null : fillValue;
    if (fillValue.startsWith('url(')) warnings.push('SVG 渐变或图案填充未导入，相关对象以无填充方式导入。');
    if (element.hasAttribute('mask') || element.hasAttribute('clip-path')) warnings.push('SVG mask/clip-path 尚未导入，相关裁切/蒙版效果会丢失。');
    const strokeValue = style(element, 'stroke', 'none');
    const stroke = strokeValue === 'none' ? null : strokeValue;
    const strokeWidth = number(style(element, 'stroke-width', '1'), 1);
    if (element.hasAttribute('transform')) warnings.push(`SVG ${tag} 元素包含 transform，当前导入暂不应用该变换。`);
    if (tag === 'rect') add(element, 'rect', { x: number(element.getAttribute('x')), y: number(element.getAttribute('y')), width: number(element.getAttribute('width')), height: number(element.getAttribute('height')) }, fill, stroke, strokeWidth);
    else if (tag === 'circle' || tag === 'ellipse') { const rx = tag === 'circle' ? number(element.getAttribute('r')) : number(element.getAttribute('rx')); const ry = tag === 'circle' ? rx : number(element.getAttribute('ry')); add(element, 'ellipse', { x: number(element.getAttribute('cx')) - rx, y: number(element.getAttribute('cy')) - ry, width: rx * 2, height: ry * 2 }, fill, stroke, strokeWidth); }
    else if (tag === 'path') { const geometry = parsePathData(element.getAttribute('d') ?? ''); if (geometry) { geometry.fillRule = element.getAttribute('fill-rule') === 'evenodd' ? 'evenodd' : 'nonzero'; add(element, 'path', geometry, fill, stroke, strokeWidth); } else warnings.push('存在不支持的 SVG path 命令，该路径已跳过。'); }
    else if (tag === 'text') { const fontSize = number(style(element, 'font-size', '16'), 16); add(element, 'text', { x: number(element.getAttribute('x')), y: number(element.getAttribute('y')), text: element.textContent ?? '', fontSize, fontFamily: style(element, 'font-family', 'Arial') }, fill, stroke, strokeWidth); }
    else if (!['defs', 'title', 'desc', 'metadata', 'style', 'lineargradient', 'radialgradient', 'clippath', 'mask'].includes(tag)) warnings.push(`未导入 SVG 元素：${tag}`);
  };
  Array.from(root.children).forEach(visit);
  if (viewBox.length === 4 && (viewBox[0] !== 0 || viewBox[1] !== 0)) warnings.push('SVG viewBox 起点偏移暂未转换。');
  return { document: doc, warnings };
}
