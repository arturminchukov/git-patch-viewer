import { describe, expect, it } from 'vitest';
import type { PatchFile } from './types';
import {
  MAX_RENDER_LINE,
  MAX_WORD_DIFF_LINE,
  fileByteSize,
  fileLineCount,
  isFileOversized,
  wordDiffAllowed,
} from './limits';

function fileWith(lines: string[]): PatchFile {
  return {
    oldPath: 'a',
    newPath: 'a',
    status: 'modified',
    additions: 0,
    deletions: 0,
    isBinary: false,
    hunks: [
      {
        header: '',
        oldStart: 1,
        oldCount: 0,
        newStart: 1,
        newCount: 0,
        lines: lines.map((text) => ({ kind: 'add' as const, text, oldNumber: null, newNumber: 1 })),
      },
    ],
  };
}

describe('wordDiffAllowed', () => {
  it('allows short lines', () => {
    expect(wordDiffAllowed('abc', 'abd')).toBe(true);
  });
  it('blocks when either side exceeds the limit', () => {
    const big = 'x'.repeat(MAX_WORD_DIFF_LINE + 1);
    expect(wordDiffAllowed(big, 'abc')).toBe(false);
    expect(wordDiffAllowed('abc', big)).toBe(false);
  });
});

describe('fileByteSize / fileLineCount', () => {
  it('sums line text lengths and counts lines', () => {
    const file = fileWith(['aa', 'bbb']);
    expect(fileByteSize(file)).toBe(5);
    expect(fileLineCount(file)).toBe(2);
  });
});

describe('isFileOversized', () => {
  it('is false for a small file', () => {
    expect(isFileOversized(fileWith(['a', 'b']))).toBe(false);
  });
  it('is true when any line exceeds MAX_RENDER_LINE', () => {
    expect(isFileOversized(fileWith(['x'.repeat(MAX_RENDER_LINE + 1)]))).toBe(true);
  });
  it('is false for binary files', () => {
    const file = fileWith(['x'.repeat(MAX_RENDER_LINE + 1)]);
    file.isBinary = true;
    expect(isFileOversized(file)).toBe(false);
  });
  it('is true when total bytes exceed the budget', () => {
    const line = 'x'.repeat(1000);
    const many = Array.from({ length: 600 }, () => line); // 600 KB > 512 KB
    expect(isFileOversized(fileWith(many))).toBe(true);
  });
});
