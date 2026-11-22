import { describe, expect, it } from 'vitest';
import { createDocument } from '../src/core/model';
import { findInDocument, replaceInDocument } from '../src/core/findReplace';
import { snapPointToGuides } from '../src/core/guides';
import { DEFAULT_SHORTCUTS, findShortcutConflicts, eventToShortcut } from '../src/core/shortcuts';

describe('find and replace', () => {
  const document = () => {
    const doc = createDocument();
    const layerId = doc.layers[0].id;
    const id = 'text_1';
    doc.objects[id] = { id, name: 'Logo artwork', kind: 'text', geometry: { x: 0, y: 0, text: 'YutuGs Photo photo', fontSize: 20, fontFamily: 'Arial' }, transform: [1,0,0,1,0,0], opacity: 1, visible: true, locked: false, layerId, fill: '#000000', stroke: null, strokeWidth: 1 };
    doc.layers[0].objectIds.push(id);
    return doc;
  };
  it('supports case sensitivity and whole-word matching', () => {
    const doc = document();
    expect(findInDocument(doc, { query: 'photo', includeNames: false }).length).toBe(2);
    expect(findInDocument(doc, { query: 'photo', includeNames: false, caseSensitive: true }).length).toBe(1);
    expect(findInDocument(doc, { query: 'Photo', includeNames: false, caseSensitive: true, wholeWord: true }).length).toBe(1);
  });
  it('replaces all matches in one returned document without mutating source', () => {
    const doc = document();
    const result = replaceInDocument(doc, { query: 'photo', replacement: 'Design', includeNames: false, all: true });
    expect(result.replacements).toBe(2);
    expect((result.document.objects.text_1 as any).geometry.text).toBe('YutuGs Design Design');
    expect((doc.objects.text_1 as any).geometry.text).toBe('YutuGs Photo photo');
  });
});

describe('shortcut registry', () => {
  it('ships the requested bindings without conflicts', () => {
    expect(DEFAULT_SHORTCUTS.find(item => item.action === 'find')?.keys).toBe('Ctrl+F');
    expect(DEFAULT_SHORTCUTS.find(item => item.action === 'replace')?.keys).toBe('Ctrl+H');
    expect(findShortcutConflicts(DEFAULT_SHORTCUTS)).toEqual([]);
  });
  it('detects duplicate bindings and normalizes modifier order', () => {
    expect(findShortcutConflicts([{ action: 'find', label: '查找', keys: 'Ctrl+F' }, { action: 'replace', label: '替换', keys: 'F+Ctrl' }])).toHaveLength(1);
    expect(eventToShortcut({ key: 'F', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false })).toBe('ctrl+f');
  });
});

describe('guide snapping', () => {
  it('snaps to the nearest visible unlocked guides only', () => {
    const result = snapPointToGuides({ x: 102, y: 48 }, [
      { id: 'x1', axis: 'x', position: 100 },
      { id: 'y1', axis: 'y', position: 50 },
      { id: 'x2', axis: 'x', position: 103, locked: true },
      { id: 'y2', axis: 'y', position: 49, visible: false },
    ], 5);
    expect(result).toEqual({ point: { x: 100, y: 50 }, snappedX: true, snappedY: true });
  });
});
