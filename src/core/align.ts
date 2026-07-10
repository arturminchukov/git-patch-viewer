// Turn a hunk's linear list of diff lines into rows for the split (two-column)
// or unified (single-column) view, with intra-line word-level segments for
// changed line pairs. Both views share the same pairing logic. Pure functions.

import type { DiffLine, Hunk } from './types';

export type SegmentKind = 'equal' | 'changed';

export interface Segment {
  kind: SegmentKind;
  text: string;
}

/** A single visual row in the split view. */
export interface SplitRow {
  /** Left (old) side, absent for pure additions. */
  left: DiffLine | null;
  /** Right (new) side, absent for pure removals. */
  right: DiffLine | null;
  /** Word-level segments for the left side, when it is a changed pair. */
  leftSegments: Segment[] | null;
  /** Word-level segments for the right side, when it is a changed pair. */
  rightSegments: Segment[] | null;
}

/** A single visual row in the unified view. */
export interface UnifiedRow {
  line: DiffLine;
  /** Word-level segments when the line belongs to a changed pair. */
  segments: Segment[] | null;
}

/**
 * A hunk broken into context lines and change blocks. Within a change block,
 * removed lines are paired positionally with added lines; the shared pairing
 * feeds both the split and unified presenters.
 */
type HunkPart =
  | { type: 'context'; line: DiffLine }
  | { type: 'change'; removes: DiffLine[]; adds: DiffLine[] };

function segmentHunk(hunk: Hunk): HunkPart[] {
  const parts: HunkPart[] = [];
  let removes: DiffLine[] = [];
  let adds: DiffLine[] = [];

  const flush = () => {
    if (removes.length || adds.length) {
      parts.push({ type: 'change', removes, adds });
      removes = [];
      adds = [];
    }
  };

  for (const line of hunk.lines) {
    if (line.kind === 'remove') {
      removes.push(line);
    } else if (line.kind === 'add') {
      adds.push(line);
    } else {
      flush();
      parts.push({ type: 'context', line });
    }
  }
  flush();
  return parts;
}

/** Segments for the i-th paired lines, or [null, null] when unpaired. */
function pairSegments(
  removes: DiffLine[],
  adds: DiffLine[],
  i: number,
): [Segment[] | null, Segment[] | null] {
  if (i < removes.length && i < adds.length) {
    return diffWords(removes[i].text, adds[i].text);
  }
  return [null, null];
}

/** Build split rows for a whole hunk. */
export function alignHunk(hunk: Hunk): SplitRow[] {
  const rows: SplitRow[] = [];
  for (const part of segmentHunk(hunk)) {
    if (part.type === 'context') {
      rows.push({ left: part.line, right: part.line, leftSegments: null, rightSegments: null });
      continue;
    }
    const { removes, adds } = part;
    const max = Math.max(removes.length, adds.length);
    for (let i = 0; i < max; i++) {
      const [leftSegments, rightSegments] = pairSegments(removes, adds, i);
      rows.push({
        left: removes[i] ?? null,
        right: adds[i] ?? null,
        leftSegments,
        rightSegments,
      });
    }
  }
  return rows;
}

/** Build unified rows: context, then all removals, then all additions. */
export function alignHunkUnified(hunk: Hunk): UnifiedRow[] {
  const rows: UnifiedRow[] = [];
  for (const part of segmentHunk(hunk)) {
    if (part.type === 'context') {
      rows.push({ line: part.line, segments: null });
      continue;
    }
    const { removes, adds } = part;
    removes.forEach((line, i) => rows.push({ line, segments: pairSegments(removes, adds, i)[0] }));
    adds.forEach((line, i) => rows.push({ line, segments: pairSegments(removes, adds, i)[1] }));
  }
  return rows;
}

/**
 * Word-level diff between two lines. Returns [leftSegments, rightSegments]
 * where "changed" marks the substrings that differ, so the UI can highlight
 * them more strongly than the rest of the line.
 */
export function diffWords(a: string, b: string): [Segment[], Segment[]] {
  const at = tokenize(a);
  const bt = tokenize(b);
  const ops = lcsDiff(at, bt);

  const left: Segment[] = [];
  const right: Segment[] = [];
  for (const op of ops) {
    if (op.type === 'equal') {
      pushSegment(left, 'equal', op.text);
      pushSegment(right, 'equal', op.text);
    } else if (op.type === 'del') {
      pushSegment(left, 'changed', op.text);
    } else {
      pushSegment(right, 'changed', op.text);
    }
  }
  return [left, right];
}

function pushSegment(target: Segment[], kind: SegmentKind, text: string) {
  const last = target[target.length - 1];
  if (last && last.kind === kind) {
    last.text += text;
  } else {
    target.push({ kind, text });
  }
}

/** Split into words, whitespace runs, and punctuation runs — kept as tokens. */
export function tokenize(s: string): string[] {
  return s.match(/(\s+|[A-Za-z0-9_]+|[^\sA-Za-z0-9_]+)/g) ?? [];
}

type DiffOp = { type: 'equal' | 'del' | 'ins'; text: string };

/** Classic LCS-based token diff. */
function lcsDiff(a: string[], b: string[]): DiffOp[] {
  const n = a.length;
  const m = b.length;
  // dp[i][j] = LCS length of a[i:] and b[j:]
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ type: 'equal', text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: 'del', text: a[i++] });
    } else {
      ops.push({ type: 'ins', text: b[j++] });
    }
  }
  while (i < n) ops.push({ type: 'del', text: a[i++] });
  while (j < m) ops.push({ type: 'ins', text: b[j++] });
  return ops;
}
