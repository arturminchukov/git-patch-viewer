// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { parse } from '../core/parser';
import { renderSidebar } from './sidebar';

const model = parse(readFileSync(join(process.cwd(), 'demo/sample.patch'), 'utf8'));

function visibleItems(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('.gpv-file-item')).filter((i) => !i.hidden);
}

describe('renderSidebar', () => {
  let el: HTMLElement;
  beforeEach(() => {
    el = renderSidebar(model.files).element;
    document.body.replaceChildren(el);
  });

  it('renders a flat list of all files by default', () => {
    expect(el.querySelector('.gpv-tree-dir')).toBeNull();
    expect(visibleItems(el)).toHaveLength(model.files.length);
  });

  it('filters files by the search query', () => {
    const search = el.querySelector<HTMLInputElement>('.gpv-search')!;
    search.value = 'response_logs';
    search.dispatchEvent(new Event('input'));

    const visible = visibleItems(el);
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.every((i) => i.dataset.path!.includes('response_logs'))).toBe(true);
    expect(el.querySelector<HTMLElement>('.gpv-search-empty')!.hidden).toBe(true);
  });

  it('shows an empty message when nothing matches', () => {
    const search = el.querySelector<HTMLInputElement>('.gpv-search')!;
    search.value = 'zzz-nope';
    search.dispatchEvent(new Event('input'));
    expect(visibleItems(el)).toHaveLength(0);
    expect(el.querySelector<HTMLElement>('.gpv-search-empty')!.hidden).toBe(false);
  });

  it('switches to a tree layout, still listing every file', () => {
    el.querySelector<HTMLButtonElement>('.gpv-btn')!.click();
    expect(el.querySelectorAll('.gpv-tree-dir').length).toBeGreaterThan(0);
    // pkg/plugin chain should collapse into one directory node.
    const dirNames = Array.from(el.querySelectorAll('.gpv-tree-summary')).map((s) => s.textContent);
    expect(dirNames).toContain('pkg/plugin');
    expect(visibleItems(el)).toHaveLength(model.files.length);
  });

  it('hides empty directories when filtering in tree mode', () => {
    el.querySelector<HTMLButtonElement>('.gpv-btn')!.click(); // to tree
    const search = el.querySelector<HTMLInputElement>('.gpv-search')!;
    search.value = 'CHANGELOG';
    search.dispatchEvent(new Event('input'));

    expect(visibleItems(el)).toHaveLength(1);
    // The pkg/plugin directory has no matching leaf, so it is hidden.
    const pkgDir = Array.from(el.querySelectorAll<HTMLElement>('.gpv-tree-dir')).find(
      (d) => d.querySelector('.gpv-tree-summary')?.textContent === 'pkg/plugin',
    )!;
    expect(pkgDir.hidden).toBe(true);
  });
});
