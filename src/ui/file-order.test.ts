import { describe, expect, it } from 'vitest';
import type { PatchFile } from '../core/types';
import { fileOrder } from './file-order';

function file(path: string): PatchFile {
  return {
    oldPath: path,
    newPath: path,
    status: 'modified',
    hunks: [],
    additions: 0,
    deletions: 0,
    isBinary: false,
  };
}

const files = [
  file('src/b.ts'), // 0
  file('README.md'), // 1
  file('src/a.ts'), // 2
];

describe('fileOrder', () => {
  it('keeps patch order in flat layout', () => {
    expect(fileOrder(files, 'flat')).toEqual([0, 1, 2]);
  });

  it('follows the tree order (dirs first, alphabetical) in tree layout', () => {
    // src/ dir first: a.ts(2), b.ts(0); then root README.md(1).
    expect(fileOrder(files, 'tree')).toEqual([2, 0, 1]);
  });
});
