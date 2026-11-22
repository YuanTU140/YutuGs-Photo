import type { EditorObject, YgsDocument } from './model';

export type FindOptions = { query: string; caseSensitive?: boolean; wholeWord?: boolean; includeNames?: boolean; includeText?: boolean };
export type FindMatch = { objectId: string; field: 'name' | 'text'; start: number; end: number };

function makeMatcher(options: FindOptions): RegExp | null {
  if (!options.query) return null;
  const escaped = options.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const source = options.wholeWord ? `(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])` : escaped;
  try { return new RegExp(source, `${options.caseSensitive ? 'gu' : 'giu'}`); } catch { return null; }
}

export function findInDocument(document: YgsDocument, options: FindOptions): FindMatch[] {
  const matcher = makeMatcher(options);
  if (!matcher) return [];
  const matches: FindMatch[] = [];
  for (const object of Object.values(document.objects)) {
    const fields: Array<{ field: 'name' | 'text'; value: string }> = [];
    if (options.includeNames !== false) fields.push({ field: 'name', value: object.name });
    if (options.includeText !== false && object.kind === 'text') fields.push({ field: 'text', value: (object.geometry as { text: string }).text });
    for (const { field, value } of fields) {
      matcher.lastIndex = 0;
      for (let match = matcher.exec(value); match; match = matcher.exec(value)) {
        matches.push({ objectId: object.id, field, start: match.index, end: match.index + match[0].length });
        if (!match[0].length) matcher.lastIndex++;
      }
    }
  }
  return matches;
}

export function replaceInDocument(document: YgsDocument, options: FindOptions & { replacement: string; all?: boolean }): { document: YgsDocument; replacements: number } {
  const matcher = makeMatcher(options);
  if (!matcher) return { document, replacements: 0 };
  const next = structuredClone(document);
  let replacements = 0;
  for (const object of Object.values(next.objects) as EditorObject[]) {
    if (options.includeNames !== false) {
      matcher.lastIndex = 0;
      const nameMatcher = options.all === false ? new RegExp(matcher.source, matcher.flags.replace('g', '')) : matcher;
      const replaced = object.name.replace(nameMatcher, () => { replacements++; return options.replacement; });
      object.name = replaced;
      if (!options.all && replacements) break;
    }
    if (options.includeText !== false && object.kind === 'text') {
      const geometry = object.geometry as { text: string };
      matcher.lastIndex = 0;
      const textMatcher = options.all === false ? new RegExp(matcher.source, matcher.flags.replace('g', '')) : matcher;
      geometry.text = geometry.text.replace(textMatcher, () => { replacements++; return options.replacement; });
      if (!options.all && replacements) break;
    }
  }
  if (replacements) next.metadata.modifiedAt = new Date().toISOString();
  return { document: next, replacements };
}
