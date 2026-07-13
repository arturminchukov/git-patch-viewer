// Sidebar: file list (flat or tree), search filter, click-to-scroll, and
// scroll-spy. `connect` is safe to call again after the content pane is
// re-rendered (e.g. on a view-mode switch).

import { buildFileTree, type TreeEntry } from '../core/tree';
import type { PatchFile } from '../core/types';
import { el } from './dom';
import { displayPath, fileDomId, statusSymbol } from './render';

export type FileLayout = 'flat' | 'tree';

export interface SidebarOptions {
  initialLayout?: FileLayout;
  onLayoutChange?: (layout: FileLayout) => void;
}

export interface SidebarHandle {
  element: HTMLElement;
  /** (Re)connect scroll-spy to the current content pane. */
  connect(scrollContainer: HTMLElement): void;
}

export function renderSidebar(files: PatchFile[], options: SidebarOptions = {}): SidebarHandle {
  let layout: FileLayout = options.initialLayout ?? 'flat';
  let query = '';
  let items: HTMLElement[] = [];
  let activeId: string | null = null;

  const listHost = el('div', { class: 'gpv-file-listhost' });
  const emptyMsg = el('div', { class: 'gpv-search-empty', text: 'No matching files' });
  emptyMsg.hidden = true;

  const search = el('input', {
    class: 'gpv-search',
    type: 'search',
    placeholder: 'Filter files…',
    'aria-label': 'Filter files',
  }) as HTMLInputElement;

  const layoutBtn = el('button', {
    class: 'gpv-btn gpv-icon-btn',
    type: 'button',
  }) as HTMLButtonElement;

  const heading = el('div', {
    class: 'gpv-sidebar-heading',
    text: `${files.length} file${files.length === 1 ? '' : 's'} changed`,
  });

  const element = el('aside', { class: 'gpv-sidebar' }, [
    el('div', { class: 'gpv-sidebar-controls' }, [search, layoutBtn]),
    heading,
    listHost,
    emptyMsg,
  ]);

  const setActive = (targetId: string | null) => {
    activeId = targetId;
    for (const item of items) {
      item.classList.toggle('active', item.dataset.target === targetId);
    }
  };

  const scrollToTarget = (id: string | undefined) => {
    if (!id) return;
    const target = (element.getRootNode() as ParentNode).querySelector<HTMLElement>(`#${id}`);
    target?.scrollIntoView({ behavior: 'instant', block: 'start' });
    setActive(id);
  };

  function createFileItem(file: PatchFile, index: number, label: string): HTMLElement {
    const item = el(
      'div',
      {
        class: 'gpv-file-item',
        'data-target': fileDomId(index),
        'data-path': displayPath(file).toLowerCase(),
        title: displayPath(file),
      },
      [
        el('span', { class: `gpv-file-status ${file.status}`, text: statusSymbol(file.status) }),
        el('span', { class: 'gpv-file-name', text: label }),
        el('span', { class: 'gpv-file-stat' }, [
          el('span', { class: 'add', text: `+${file.additions}` }),
          document.createTextNode(' '),
          el('span', { class: 'del', text: `-${file.deletions}` }),
        ]),
      ],
    );
    item.addEventListener('click', () => scrollToTarget(item.dataset.target));
    items.push(item);
    return item;
  }

  function renderFlat(): Node {
    const frag = document.createDocumentFragment();
    files.forEach((file, i) => frag.append(createFileItem(file, i, displayPath(file))));
    return frag;
  }

  function renderTreeEntries(entries: TreeEntry[]): Node {
    const frag = document.createDocumentFragment();
    for (const entry of entries) {
      if (entry.type === 'file') {
        frag.append(createFileItem(files[entry.index], entry.index, entry.name));
      } else {
        frag.append(
          el('details', { class: 'gpv-tree-dir', open: true }, [
            el('summary', { class: 'gpv-tree-summary', text: entry.name }),
            el('div', { class: 'gpv-tree-children' }, [renderTreeEntries(entry.children)]),
          ]),
        );
      }
    }
    return frag;
  }

  function applyFilter(): void {
    const q = query.trim().toLowerCase();
    let anyVisible = false;
    for (const item of items) {
      const match = q === '' || (item.dataset.path ?? '').includes(q);
      item.hidden = !match;
      anyVisible = anyVisible || match;
    }
    // In tree mode, hide directories that have no visible descendant file.
    for (const dir of listHost.querySelectorAll<HTMLElement>('.gpv-tree-dir')) {
      dir.hidden = dir.querySelector('.gpv-file-item:not([hidden])') === null;
    }
    emptyMsg.hidden = anyVisible;
  }

  function buildList(): void {
    items = [];
    listHost.replaceChildren(
      layout === 'tree'
        ? renderTreeEntries(buildFileTree(files.map((f, i) => ({ path: displayPath(f), index: i }))))
        : renderFlat(),
    );
    applyFilter();
    setActive(activeId ?? items[0]?.dataset.target ?? null);
  }

  const syncLayoutBtn = () => {
    layoutBtn.textContent = layout === 'flat' ? '⊟' : '≡';
    layoutBtn.title = `Switch to ${layout === 'flat' ? 'tree' : 'flat'} view`;
    layoutBtn.setAttribute('aria-label', layoutBtn.title);
  };

  layoutBtn.addEventListener('click', () => {
    layout = layout === 'flat' ? 'tree' : 'flat';
    syncLayoutBtn();
    buildList();
    options.onLayoutChange?.(layout);
  });

  search.addEventListener('input', () => {
    query = search.value;
    applyFilter();
  });

  syncLayoutBtn();
  buildList();

  let observer: IntersectionObserver | null = null;

  function connect(scrollContainer: HTMLElement): void {
    if (typeof IntersectionObserver === 'undefined') return;
    observer?.disconnect();
    observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) setActive(visible[0].target.id);
      },
      { root: scrollContainer, rootMargin: '0px 0px -70% 0px', threshold: 0 },
    );
    for (const section of scrollContainer.querySelectorAll<HTMLElement>('.gpv-file')) {
      observer.observe(section);
    }
  }

  return { element, connect };
}
