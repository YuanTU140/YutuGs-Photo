export type ShortcutAction = 'find' | 'replace' | 'raiseObject' | 'lowerObject' | 'save' | 'undo' | 'redo';
export type ShortcutBinding = { action: ShortcutAction; label: string; keys: string };
export const DEFAULT_SHORTCUTS: ShortcutBinding[] = [
  { action: 'find', label: '查找', keys: 'Ctrl+F' },
  { action: 'replace', label: '查找和替换', keys: 'Ctrl+H' },
  { action: 'raiseObject', label: '对象上移一层', keys: 'Ctrl+PageUp' },
  { action: 'lowerObject', label: '对象下移一层', keys: 'Ctrl+PageDown' },
  { action: 'save', label: '保存', keys: 'Ctrl+S' },
  { action: 'undo', label: '撤销', keys: 'Ctrl+Z' },
  { action: 'redo', label: '重做', keys: 'Ctrl+Y' },
];
export function normalizeShortcut(keys: string): string {
  return keys.split('+').map(part => part.trim().toLowerCase()).sort((a,b) => a.localeCompare(b)).join('+');
}
export function findShortcutConflicts(bindings: ShortcutBinding[]): Array<{ keys: string; actions: ShortcutAction[] }> {
  const groups = new Map<string, ShortcutAction[]>();
  for (const binding of bindings) {
    const key = normalizeShortcut(binding.keys);
    groups.set(key, [...(groups.get(key) ?? []), binding.action]);
  }
  return [...groups.entries()].filter(([, actions]) => actions.length > 1).map(([keys, actions]) => ({ keys, actions }));
}
export function eventToShortcut(event: Pick<KeyboardEvent, 'key'|'ctrlKey'|'metaKey'|'altKey'|'shiftKey'>): string {
  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) parts.push('ctrl');
  if (event.altKey) parts.push('alt');
  if (event.shiftKey) parts.push('shift');
  parts.push(event.key === ' ' ? 'space' : event.key.toLowerCase());
  return normalizeShortcut(parts.join('+'));
}
