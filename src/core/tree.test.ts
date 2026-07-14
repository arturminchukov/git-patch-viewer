import { describe, expect, it } from 'vitest';
import { buildFileTree, flattenTree, type DirNode, type FileLeaf } from './tree';

describe('buildFileTree', () => {
  it('groups files by directory', () => {
    const tree = buildFileTree([
      { path: 'src/a.ts', index: 0 },
      { path: 'src/b.ts', index: 1 },
      { path: 'README.md', index: 2 },
    ]);
    // Directories first, then files, both alphabetical.
    expect(tree[0].type).toBe('dir');
    expect((tree[0] as DirNode).name).toBe('src');
    expect((tree[0] as DirNode).children.map((c) => c.name)).toEqual(['a.ts', 'b.ts']);
    expect(tree[1].type).toBe('file');
    expect((tree[1] as FileLeaf).name).toBe('README.md');
  });

  it('collapses single-child directory chains', () => {
    const tree = buildFileTree([
      { path: 'pkg/plugin/response_logs.go', index: 0 },
      { path: 'pkg/plugin/datasource_test.go', index: 1 },
    ]);
    expect(tree).toHaveLength(1);
    expect((tree[0] as DirNode).name).toBe('pkg/plugin');
    expect((tree[0] as DirNode).children).toHaveLength(2);
  });

  it('keeps the original file index and full path on leaves', () => {
    const tree = buildFileTree([{ path: 'a/b/c.txt', index: 7 }]);
    const dir = tree[0] as DirNode;
    expect(dir.name).toBe('a/b');
    const leaf = dir.children[0] as FileLeaf;
    expect(leaf).toMatchObject({ type: 'file', name: 'c.txt', path: 'a/b/c.txt', index: 7 });
  });
});

describe('flattenTree', () => {
  it('returns leaf indices in depth-first, directories-first order', () => {
    // Patch order: src/b.ts(0), README.md(1), src/a.ts(2)
    const tree = buildFileTree([
      { path: 'src/b.ts', index: 0 },
      { path: 'README.md', index: 1 },
      { path: 'src/a.ts', index: 2 },
    ]);
    // Tree order: dir "src" first (a.ts=2, b.ts=0 alphabetical), then README.md=1.
    expect(flattenTree(tree)).toEqual([2, 0, 1]);
  });
});
