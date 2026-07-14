// Content-script entry point. This is the only module with side effects:
// it reads the page, guards it, builds the Shadow DOM UI, and mounts it.

import { parse } from '../core/parser';
import type { CommitMeta, PatchModel } from '../core/types';
import { el } from '../ui/dom';
import { fileOrder } from '../ui/file-order';
import { renderFiles } from '../ui/render';
import { renderSidebar, type FileLayout } from '../ui/sidebar';
import { browserStorage, type PersistentValue } from '../ui/storage';
import { STYLES } from '../ui/styles';
import {
  applyTheme,
  attachThemeToggle,
  browserThemeStorage,
  resolveInitialTheme,
  type Theme,
} from '../ui/theme';
import {
  attachViewToggle,
  browserViewStorage,
  resolveInitialView,
  type ViewMode,
} from '../ui/view';
import { looksLikeDiff } from './detect';
import { showLoader } from './loader';

/** Resolve once the document body is parsed and readable. */
function domReady(): Promise<void> {
  if (document.readyState !== 'loading') return Promise.resolve();
  return new Promise((resolve) => {
    document.addEventListener('DOMContentLoaded', () => resolve(), { once: true });
  });
}

async function run(): Promise<void> {
  // Runs at document_start: hide the raw text and show a loader before the
  // browser can flash the unstyled patch, then parse once the DOM is ready.
  const reveal = showLoader();

  try {
    await domReady();

    // textContent (not innerText) so it reads correctly while the body is hidden.
    const raw = document.body?.textContent ?? '';
    if (!looksLikeDiff(raw)) {
      reveal();
      return;
    }

    const model = parse(raw);
    if (model.files.length === 0) {
      reveal();
      return;
    }

    const host = el('div', { id: 'git-patch-viewer-host' });
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.append(el('style', { text: STYLES }));

    const root = el('div', { class: 'gpv-root' });
    shadow.append(root);

    const themeStorage = browserThemeStorage();
    const viewStorage = browserViewStorage();
    const layoutStorage = browserStorage<FileLayout>('gpv-filelayout', ['flat', 'tree']);
    const theme = await resolveInitialTheme(themeStorage);
    const view = await resolveInitialView(viewStorage);
    const layout = (await layoutStorage.get()) ?? 'flat';
    applyTheme(root, theme);

    try {
      mount(root, model, { theme, themeStorage, view, viewStorage, layout, layoutStorage });
    } catch (err) {
      root.append(
        el('div', {
          class: 'gpv-error',
          text: `Failed to render patch: ${err instanceof Error ? err.message : String(err)}`,
        }),
      );
    }

    // Replace the visible page and prevent the outer document from scrolling;
    // scrolling happens inside the content pane only.
    document.documentElement.style.cssText = 'margin:0;height:100%;overflow:hidden';
    document.body.style.cssText = 'margin:0;height:100%;overflow:hidden';
    document.body.replaceChildren(host);
    document.title = titleFor(model);
    reveal();
  } catch (err) {
    // Never leave the page hidden if something unexpected fails.
    reveal();
    console.error('[git-patch-viewer]', err);
  }
}

interface MountOptions {
  theme: Theme;
  themeStorage: ReturnType<typeof browserThemeStorage>;
  view: ViewMode;
  viewStorage: ReturnType<typeof browserViewStorage>;
  layout: FileLayout;
  layoutStorage: PersistentValue<FileLayout>;
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

  // Render the diff sections in the same order the sidebar lists them (flat =
  // patch order, tree = tree order), so a file's position matches its diff.
  // `sidebar` is referenced here but assigned just below; repaint only runs
  // after it exists.
  const repaint = () => {
    const order = fileOrder(model.files, layout);
    content.replaceChildren(renderFiles(model.files, view, order));
    sidebar.connect(content);
  };

  const sidebar = renderSidebar(model.files, {
    initialLayout: layout,
    onLayoutChange: (l) => {
      layout = l;
      void opts.layoutStorage.set(l);
      repaint();
    },
  });

  attachViewToggle(viewBtn, opts.viewStorage, view, (mode) => {
    view = mode;
    repaint();
  });

  const body = el('div', { class: 'gpv-body' }, [sidebar.element, content]);
  root.append(toolbar);
  if (model.commit) root.append(renderCommitPanel(model.commit));
  root.append(body);

  repaint();
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
    children.push(
      el('details', { class: 'gpv-commit-details', open: true }, [
        el('summary', { text: 'Description' }),
        el('div', { class: 'gpv-commit-body', text: commit.body }),
      ]),
    );
  }
  return el('div', { class: 'gpv-commit' }, children);
}

function titleFor(model: PatchModel): string {
  if (model.commit?.subject) return model.commit.subject;
  const first = model.files[0];
  const name = first ? (first.newPath ?? first.oldPath ?? 'patch') : 'patch';
  return model.files.length > 1 ? `${name} +${model.files.length - 1} more` : name;
}

void run();
