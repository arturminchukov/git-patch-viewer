import type { CommitMeta, PatchModel } from '../core/types';
import { el } from './dom';
import { fileOrder } from './file-order';
import { renderFileSections } from './render';
import { attachResizer } from './resizer';
import { renderSidebar, type FileLayout } from './sidebar';
import { browserNumberStorage, browserStorage, type PersistentValue } from './storage';
import { STYLES } from './styles';
import {
  applyTheme,
  attachThemeToggle,
  browserThemeStorage,
  resolveInitialTheme,
  type Theme,
} from './theme';
import {
  attachViewToggle,
  browserViewStorage,
  resolveInitialView,
  type ViewMode,
} from './view';

const SIDEBAR_WIDTH = { min: 180, default: 280, max: 640 } as const;

export async function mountPatch(model: PatchModel): Promise<void> {
  const host = el('div', { id: 'git-patch-viewer-host' });
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.append(el('style', { text: STYLES }));

  const root = el('div', { class: 'gpv-root' });
  shadow.append(root);

  const themeStorage = browserThemeStorage();
  const viewStorage = browserViewStorage();
  const layoutStorage = browserStorage<FileLayout>('gpv-filelayout', ['flat', 'tree']);
  const widthStorage = browserNumberStorage('gpv-sidebar-w', SIDEBAR_WIDTH);
  const theme = await resolveInitialTheme(themeStorage);
  const view = await resolveInitialView(viewStorage);
  const layout = (await layoutStorage.get()) ?? 'flat';
  const sidebarWidth = (await widthStorage.get()) ?? SIDEBAR_WIDTH.default;
  applyTheme(root, theme);

  mount(root, model, {
    theme,
    themeStorage,
    view,
    viewStorage,
    layout,
    layoutStorage,
    sidebarWidth,
    widthStorage,
  });
  // Let the document own vertical scrolling, including on raw text pages
  // whose browser-provided styles would otherwise constrain the viewer.
  document.documentElement.style.cssText = 'margin:0';
  document.body.style.cssText = 'margin:0';
  document.body.replaceChildren(host);
  document.title = titleFor(model);
}

interface MountOptions {
  theme: Theme;
  themeStorage: ReturnType<typeof browserThemeStorage>;
  view: ViewMode;
  viewStorage: ReturnType<typeof browserViewStorage>;
  layout: FileLayout;
  layoutStorage: PersistentValue<FileLayout>;
  sidebarWidth: number;
  widthStorage: PersistentValue<number>;
}

function mount(root: HTMLElement, model: PatchModel, opts: MountOptions): void {
  const themeBtn = el('button', { class: 'gpv-btn gpv-icon-btn', type: 'button' });
  attachThemeToggle(root, themeBtn, opts.themeStorage, opts.theme);

  const viewBtn = el('button', { class: 'gpv-btn', type: 'button' });

  const toolbar = el('div', { class: 'gpv-toolbar' }, [
    el('span', { class: 'gpv-toolbar-title', text: 'Git Patch Viewer' }),
    viewBtn,
    themeBtn,
  ]);

  let view = opts.view;
  let layout = opts.layout;
  const content = el('div', { class: 'gpv-content' });

  // Oversized files the user expanded via "Render anyway"; kept so a view-mode
  // rebuild (which recreates every section) doesn't silently re-collapse them.
  const expanded = new Set<number>();

  // File sections indexed by original file index, reused across layout
  // switches. `sidebar` is referenced below but assigned further down; the
  // callbacks only fire after it exists.
  let sections: HTMLElement[] = [];

  // Order the existing sections to match the sidebar (flat = patch order,
  // tree = tree order). A layout switch only reorders nodes, no rebuild.
  const applyOrder = () => {
    const order = fileOrder(model.files, layout);
    content.replaceChildren(...order.map((i) => sections[i]));
  };

  // Full (re)build for the current view mode: rebuild section DOM, order it,
  // then reconnect scroll-spy. Used on mount and view-mode change.
  const paintContent = () => {
    sections = renderFileSections(model.files, view, {
      expanded,
      onExpand: (i) => expanded.add(i),
    });
    applyOrder();
    sidebar.connect(content);
  };

  const sidebar = renderSidebar(model.files, {
    initialLayout: layout,
    onLayoutChange: (l) => {
      layout = l;
      void opts.layoutStorage.set(l);
      // Existing sections persist, so scroll-spy stays connected — just reorder.
      applyOrder();
    },
  });

  attachViewToggle(viewBtn, opts.viewStorage, view, (mode) => {
    view = mode;
    paintContent();
  });

  const resizer = el('div', {
    class: 'gpv-resizer',
    role: 'separator',
    'aria-orientation': 'vertical',
    'aria-label': 'Resize sidebar',
  });
  const body = el('div', { class: 'gpv-body' }, [sidebar.element, resizer, content]);

  const setSidebarWidth = (width: number) => {
    body.style.setProperty('--gpv-sidebar-w', `${width}px`);
  };
  setSidebarWidth(opts.sidebarWidth);
  attachResizer(root, resizer, {
    min: SIDEBAR_WIDTH.min,
    max: SIDEBAR_WIDTH.max,
    current: () => sidebar.element.getBoundingClientRect().width,
    apply: setSidebarWidth,
    commit: (width) => {
      setSidebarWidth(width);
      void opts.widthStorage.set(width);
    },
  });

  root.append(toolbar);
  if (model.commit) root.append(renderCommitPanel(model.commit));
  root.append(body);

  paintContent();
}

function renderCommitPanel(commit: CommitMeta): HTMLElement {
  const metaBits = [commit.author, commit.date, commit.sha?.slice(0, 8)].filter(Boolean) as string[];
  const children: Node[] = [
    el('div', { class: 'gpv-commit-subject', text: commit.subject ?? 'Commit' }),
  ];
  if (metaBits.length) {
    children.push(el('div', { class: 'gpv-commit-meta', text: metaBits.join(' · ') }));
  }
  if (commit.body) {
    const collapseBtn = el('button', {
      class: 'gpv-commit-collapse',
      type: 'button',
      text: 'Collapse description',
    }) as HTMLButtonElement;
    const details = el('details', { class: 'gpv-commit-details', open: true }, [
      el('summary', { text: 'Description' }),
      el('div', { class: 'gpv-commit-body', text: commit.body }),
      collapseBtn,
    ]);
    // Collapse from the bottom of a long description, without scrolling back to
    // the summary toggle; the summary reopens it.
    collapseBtn.addEventListener('click', () => {
      details.open = false;
    });
    children.push(details);
  }
  return el('div', { class: 'gpv-commit' }, children);
}

function titleFor(model: PatchModel): string {
  if (model.commit?.subject) return model.commit.subject;
  const first = model.files[0];
  const name = first ? (first.newPath ?? first.oldPath ?? 'patch') : 'patch';
  return model.files.length > 1 ? `${name} +${model.files.length - 1} more` : name;
}
