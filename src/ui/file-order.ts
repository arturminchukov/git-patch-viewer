// The order in which files appear, for a given sidebar layout. The content
// pane renders sections in this same order so the diff order always matches
// the sidebar (flat = patch order; tree = depth-first tree order).

import { buildFileTree, flattenTree } from '../core/tree';
import type { PatchFile } from '../core/types';
import { displayPath } from './render';
import type { FileLayout } from './sidebar';

export function fileOrder(files: PatchFile[], layout: FileLayout): number[] {
  if (layout === 'flat') return files.map((_, i) => i);
  const entries = files.map((file, index) => ({ path: displayPath(file), index }));
  return flattenTree(buildFileTree(entries));
}
