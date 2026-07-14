// @vitest-environment jsdom
// Regression test for the search filter: hidden files must actually disappear.
// Uses the real STYLES so the cascade (the `.gpv-file-item[hidden]` fix vs the
// `.gpv-file-item { display: flex }` rule) is exercised via getComputedStyle.

import { beforeEach, describe, expect, it } from 'vitest';
import type { PatchFile } from '../core/types';
import { renderSidebar } from './sidebar';
import { STYLES } from './styles';

function file(path: string): PatchFile {
  return {
    oldPath: path,
    newPath: path,
    status: 'modified',
    hunks: [],
    additions: 1,
    deletions: 0,
    isBinary: false,
  };
}

// Mirrors the user's report: Go files under pkg/plugin, frontend under src/,
// CHANGELOG at the root. Only src/types.ts contains "types".
const PATHS = [
  'pkg/plugin/datasource_test.go',
  'pkg/plugin/datasource.go',
  'pkg/plugin/query.go',
  'pkg/plugin/response_logs_test.go',
  'pkg/plugin/response_logs.go',
  'src/components/QueryEditorOptions.tsx',
  'src/utils/hashString.test.ts',
  'src/utils/hashString.ts',
  'src/index.ts',
  'src/datasource.ts',
  'src/types.ts',
  'CHANGELOG.md',
];

function isVisible(el: Element): boolean {
  return getComputedStyle(el).display !== 'none';
}

function search(value: string): void {
  const input = document.querySelector<HTMLInputElement>('.gpv-search')!;
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

describe('sidebar search filter — computed visibility', () => {
  beforeEach(() => {
    document.head.replaceChildren();
    const style = document.createElement('style');
    style.textContent = STYLES;
    document.head.append(style);

    const sidebar = renderSidebar(PATHS.map(file));
    document.body.replaceChildren(sidebar.element);
  });

  it('shows every file when the query is empty', () => {
    const items = document.querySelectorAll('.gpv-file-item');
    expect(items).toHaveLength(PATHS.length);
    for (const item of items) expect(isVisible(item)).toBe(true);
  });

  it('hides every file that does not match "types"', () => {
    search('types');
    const items = Array.from(document.querySelectorAll<HTMLElement>('.gpv-file-item'));
    const visible = items.filter(isVisible).map((i) => i.dataset.path);
    // Only src/types.ts should remain — not its src/ siblings, not root files.
    expect(visible).toEqual(['src/types.ts']);
  });

  it('restores all files when the query is cleared', () => {
    search('types');
    search('');
    const items = document.querySelectorAll('.gpv-file-item');
    for (const item of items) expect(isVisible(item)).toBe(true);
  });
});
