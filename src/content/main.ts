// Content-script entry point. This is the only module with side effects:
// it reads the page, guards it, builds the Shadow DOM UI, and mounts it.

import { parse } from '../core/parser';
import type { CommitMeta, PatchModel } from '../core/types';
import { el } from '../ui/dom';
import { renderFiles } from '../ui/render';
import { renderSidebar, type FileLayout, type SidebarHandle } from '../ui/sidebar';
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

async function run(): Promise<void> {
  const raw = document.body?.innerText ?? '';
  if (!looksLikeDiff(raw)) return;

  const model = parse(raw);
  if (model.files.length === 0) return;

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

  const sidebar = renderSidebar(model.files, {
    initialLayout: opts.layout,
    onLayoutChange: (l) => void opts.layoutStorage.set(l),
  });
  const content = renderContent(model, sidebar, opts.view);

  const body = el('div', { class: 'gpv-body' }, [sidebar.element, content.element]);

  root.append(toolbar);
  if (model.commit) root.append(renderCommitPanel(model.commit));
  root.append(body);

  attachViewToggle(viewBtn, opts.viewStorage, opts.view, (mode) => content.setMode(mode));
}

interface ContentHandle {
  element: HTMLElement;
  setMode(mode: ViewMode): void;
}

/** The scrollable diff pane; re-renders in place when the view mode changes. */
function renderContent(
  model: PatchModel,
  sidebar: SidebarHandle,
  initial: ViewMode,
): ContentHandle {
  const element = el('div', { class: 'gpv-content' });
  const paint = (mode: ViewMode) => {
    element.replaceChildren(renderFiles(model.files, mode));
    sidebar.connect(element);
  };
  paint(initial);
  return { element, setMode: paint };
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
