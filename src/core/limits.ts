// Central thresholds and predicates that decide when large diff content must be
// degraded to keep the viewer responsive. Pure — no DOM, no I/O.

import type { PatchFile } from './types';

/** Above this line length (either side) intra-line word diff is skipped. */
export const MAX_WORD_DIFF_LINE = 2000;
/** Above this single-line length the rendered text is truncated. */
export const MAX_RENDER_LINE = 5000;
/** Files whose changed text exceeds this many bytes render collapsed. */
export const FILE_BYTE_BUDGET = 512 * 1024;
/** Files with more changed lines than this render collapsed. */
export const FILE_LINE_BUDGET = 20000;

/** Whether an intra-line word diff between two lines is cheap enough to run. */
export function wordDiffAllowed(a: string, b: string): boolean {
  return Math.max(a.length, b.length) <= MAX_WORD_DIFF_LINE;
}

/** Total length of all hunk line texts in a file. */
export function fileByteSize(file: PatchFile): number {
  let total = 0;
  for (const hunk of file.hunks) {
    for (const line of hunk.lines) total += line.text.length;
  }
  return total;
}

/** Number of hunk lines in a file. */
export function fileLineCount(file: PatchFile): number {
  let count = 0;
  for (const hunk of file.hunks) count += hunk.lines.length;
  return count;
}

/**
 * Whether a file is too large to render eagerly and should collapse.
 * Single pass with an early return on the first giant line so pathological
 * files are classified without scanning every byte.
 */
export function isFileOversized(file: PatchFile): boolean {
  if (file.isBinary) return false;
  let bytes = 0;
  let lines = 0;
  for (const hunk of file.hunks) {
    for (const line of hunk.lines) {
      if (line.text.length > MAX_RENDER_LINE) return true;
      bytes += line.text.length;
      lines++;
    }
  }
  return bytes > FILE_BYTE_BUDGET || lines > FILE_LINE_BUDGET;
}
