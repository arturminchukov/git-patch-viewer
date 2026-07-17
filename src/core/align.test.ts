import { describe, expect, it } from 'vitest';
import { alignHunk, alignHunkUnified, diffWords, tokenize } from './align';
import type { Hunk } from './types';

function hunk(lines: Hunk['lines']): Hunk {
  return { header: '', oldStart: 1, oldCount: 0, newStart: 1, newCount: 0, lines };
}

describe('tokenize', () => {
  it('keeps words, whitespace, and punctuation as separate tokens', () => {
    expect(tokenize('old := "a"')).toEqual(['old', ' ', ':=', ' ', '"', 'a', '"']);
  });
});

describe('diffWords', () => {
  it('marks only the changed substring, leaving shared parts equal', () => {
    const [left, right] = diffWords('old := "a"', 'new := "b"');

    const leftChanged = left.filter((s) => s.kind === 'changed').map((s) => s.text);
    const rightChanged = right.filter((s) => s.kind === 'changed').map((s) => s.text);
    expect(leftChanged).toContain('old');
    expect(leftChanged).toContain('a');
    expect(rightChanged).toContain('new');
    expect(rightChanged).toContain('b');

    // The shared ` := "` region stays equal on both sides.
    expect(left.some((s) => s.kind === 'equal' && s.text.includes(':='))).toBe(true);
    expect(right.some((s) => s.kind === 'equal' && s.text.includes(':='))).toBe(true);
  });

  it('reconstructs each side exactly from its segments', () => {
    const [left, right] = diffWords('the quick brown fox', 'the slow brown cat');
    expect(left.map((s) => s.text).join('')).toBe('the quick brown fox');
    expect(right.map((s) => s.text).join('')).toBe('the slow brown cat');
  });
});

describe('alignHunk', () => {
  it('spans context lines across both columns', () => {
    const rows = alignHunk(
      hunk([{ kind: 'context', text: 'keep', oldNumber: 1, newNumber: 1 }]),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].left).toBe(rows[0].right);
  });

  it('pairs a removed line with an added line and computes segments', () => {
    const rows = alignHunk(
      hunk([
        { kind: 'remove', text: 'foo old', oldNumber: 1, newNumber: null },
        { kind: 'add', text: 'foo new', oldNumber: null, newNumber: 1 },
      ]),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].left?.text).toBe('foo old');
    expect(rows[0].right?.text).toBe('foo new');
    expect(rows[0].leftSegments).not.toBeNull();
    expect(rows[0].rightSegments).not.toBeNull();
  });

  it('emits single-sided rows for unbalanced add/remove counts', () => {
    const rows = alignHunk(
      hunk([
        { kind: 'remove', text: 'r1', oldNumber: 1, newNumber: null },
        { kind: 'add', text: 'a1', oldNumber: null, newNumber: 1 },
        { kind: 'add', text: 'a2', oldNumber: null, newNumber: 2 },
      ]),
    );
    expect(rows).toHaveLength(2);
    // First row is a paired change; second is an addition with no left side.
    expect(rows[0].left?.text).toBe('r1');
    expect(rows[0].right?.text).toBe('a1');
    expect(rows[1].left).toBeNull();
    expect(rows[1].right?.text).toBe('a2');
  });

  it('keeps pure additions on the right only', () => {
    const rows = alignHunk(
      hunk([{ kind: 'add', text: 'added', oldNumber: null, newNumber: 1 }]),
    );
    expect(rows[0].left).toBeNull();
    expect(rows[0].right?.text).toBe('added');
    expect(rows[0].rightSegments).toBeNull();
  });
});

describe('alignHunkUnified', () => {
  it('emits context, then removals, then additions in order', () => {
    const rows = alignHunkUnified(
      hunk([
        { kind: 'context', text: 'keep', oldNumber: 1, newNumber: 1 },
        { kind: 'remove', text: 'foo old', oldNumber: 2, newNumber: null },
        { kind: 'add', text: 'foo new', oldNumber: null, newNumber: 2 },
      ]),
    );
    expect(rows.map((r) => r.line.kind)).toEqual(['context', 'remove', 'add']);
    // The paired remove/add lines carry word-level segments.
    expect(rows[1].segments).not.toBeNull();
    expect(rows[2].segments).not.toBeNull();
    // Context lines have none.
    expect(rows[0].segments).toBeNull();
  });

  it('leaves unpaired lines without segments', () => {
    const rows = alignHunkUnified(
      hunk([{ kind: 'add', text: 'added', oldNumber: null, newNumber: 1 }]),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].segments).toBeNull();
  });
});

describe('word-diff guard', () => {
  it('skips intra-line diff for oversized line pairs (returns null segments)', () => {
    const big = 'x'.repeat(3000); // > MAX_WORD_DIFF_LINE (2000)
    const rows = alignHunk(
      hunk([
        { kind: 'remove', text: big + 'a', oldNumber: 1, newNumber: null },
        { kind: 'add', text: big + 'b', oldNumber: null, newNumber: 1 },
      ]),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].leftSegments).toBeNull();
    expect(rows[0].rightSegments).toBeNull();
  });

  it('still diffs short pairs', () => {
    const rows = alignHunk(
      hunk([
        { kind: 'remove', text: 'foo old', oldNumber: 1, newNumber: null },
        { kind: 'add', text: 'foo new', oldNumber: null, newNumber: 1 },
      ]),
    );
    expect(rows[0].leftSegments).not.toBeNull();
  });
});
