import type { EditorCommand } from './commands';
import { reduceDocument } from './commands';
import type { YgsDocument } from './model';

export type HistoryState = { document: YgsDocument; past: YgsDocument[]; future: YgsDocument[]; limit: number };
export const createHistory = (document: YgsDocument, limit = 100): HistoryState => ({ document, past: [], future: [], limit });
export function dispatch(state: HistoryState, command: EditorCommand): HistoryState {
  const document = reduceDocument(state.document, command);
  return { ...state, document, past: [...state.past, state.document].slice(-state.limit), future: [] };
}
export function undo(state: HistoryState): HistoryState {
  if (!state.past.length) return state;
  const previous = state.past[state.past.length - 1];
  return { ...state, document: previous, past: state.past.slice(0, -1), future: [state.document, ...state.future] };
}
export function redo(state: HistoryState): HistoryState {
  if (!state.future.length) return state;
  const next = state.future[0];
  return { ...state, document: next, past: [...state.past, state.document].slice(-state.limit), future: state.future.slice(1) };
}
