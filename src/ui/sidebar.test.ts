// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parse } from '../core/parser';
import { renderSidebar } from './sidebar';

const model = parse(readFileSync(join(process.cwd(), 'demo/sample.patch'), 'utf8'));

function visibleItems(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('.gpv-file-item')).filter(
    (i) => !i.classList.contains('gpv-hidden'),
  );
}

describe('renderSidebar', () => {
  let el: HTMLElement;
  beforeEach(() => {
    el = renderSidebar(model.files).element;
    document.body.replaceChildren(el);
  });

  it('observes file sections against the page viewport and reconnects after repaint', () => {
    const observe = vi.fn();
    const disconnect = vi.fn();
    const observer = vi.fn(function () { return { observe, disconnect }; });
    vi.stubGlobal('IntersectionObserver', observer);
    try {
      const sidebar = renderSidebar(model.files);
      const content = document.createElement('div');
      content.innerHTML = '<section class="gpv-file" id="gpv-file-0"></section>';
      sidebar.connect(content);
      expect(observer).toHaveBeenCalledWith(expect.any(Function), {
        root: null, rootMargin: '0px 0px -70% 0px', threshold: 0,
      });
      expect(observe).toHaveBeenCalledWith(content.firstElementChild);
      sidebar.connect(content);
      expect(disconnect).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('realigns navigation after deferred layout and stops once geometry settles', () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    try {
      const target = document.createElement('section');
      target.id = 'gpv-file-0';
      let top = 12;
      let height = 440;
      target.getBoundingClientRect = () => ({ top, height }) as DOMRect;
      target.scrollIntoView = vi.fn(() => { top = 12; });
      document.body.append(target);
      el.querySelector<HTMLElement>('.gpv-file-item')!.click();
      expect(target.scrollIntoView).toHaveBeenCalledOnce();
      const frame = () => {
        expect(frames.length).toBeGreaterThan(0);
        frames.shift()!(0);
      };
      frame();
      // A section can first reveal its estimated hunk height, then move when
      // nearby skipped sections resolve their intrinsic sizes on a later frame.
      height = 3260;
      frame();
      top = -1190;
      frame();
      expect(top).toBe(12);
      expect(target.scrollIntoView).toHaveBeenCalledTimes(2);
      for (let i = 0; i < 4 && frames.length; i++) frame();
      expect(frames).toHaveLength(0);
      expect(target.scrollIntoView).toHaveBeenCalledTimes(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it.each(['wheel', 'touchstart', 'pointerdown', 'keydown'])('does not undo user %s input during navigation', (event) => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    try {
      const target = document.createElement('section');
      target.id = 'gpv-file-0';
      let top = 12;
      target.getBoundingClientRect = () => ({ top, height: 1000 }) as DOMRect;
      target.scrollIntoView = vi.fn();
      document.body.append(target);
      el.querySelector<HTMLElement>('.gpv-file-item')!.click();
      window.dispatchEvent(new Event(event));
      top = -400;
      expect(frames).toHaveLength(1);
      frames.shift()!(0);
      expect(target.scrollIntoView).toHaveBeenCalledOnce();
      expect(frames).toHaveLength(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('bounds navigation checks even when section geometry keeps changing', () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    try {
      const target = document.createElement('section');
      target.id = 'gpv-file-0';
      let height = 1000;
      target.getBoundingClientRect = () => ({ top: 12, height }) as DOMRect;
      target.scrollIntoView = vi.fn();
      document.body.append(target);
      el.querySelector<HTMLElement>('.gpv-file-item')!.click();
      let count = 0;
      while (frames.length && count < 25) {
        height += 10;
        count++;
        frames.shift()!(0);
      }
      expect(count).toBe(20);
      expect(frames).toHaveLength(0);
      expect(target.scrollIntoView).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
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
    expect(pkgDir.classList.contains('gpv-hidden')).toBe(true);
  });
});
