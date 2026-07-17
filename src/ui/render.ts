// Build DOM for the diff content area from a PatchModel. No I/O; given a model
// it returns nodes. Alignment/word-diff comes from core/align.

import {
  alignHunk,
  alignHunkUnified,
  type Segment,
  type SplitRow,
  type UnifiedRow,
} from '../core/align';
import { MAX_RENDER_LINE, fileByteSize, fileLineCount, isFileOversized } from '../core/limits';
import type { DiffLine, FileStatus, Hunk, PatchFile } from '../core/types';
import { el } from './dom';
import type { ViewMode } from './view';

const STATUS_SYMBOL: Record<FileStatus, string> = {
  added: 'A',
  deleted: 'D',
  modified: 'M',
  renamed: 'R',
  binary: 'B',
};

/** Stable per-file DOM id so the sidebar can scroll to it. */
export function fileDomId(index: number): string {
  return `gpv-file-${index}`;
}

/** Cross-render state for which oversized files the user chose to expand. */
export interface RenderOptions {
  /** File indices expanded via "Render anyway"; rendered in full, not collapsed. */
  expanded?: Set<number>;
  /** Called when the user expands a collapsed file, so callers can persist it. */
  onExpand?: (index: number) => void;
}

// Approximate rendered row height (px) used to reserve section space so
// content-visibility can skip off-screen work without collapsing the scrollbar.
const ROW_HEIGHT = 20;

function expandedHeight(file: PatchFile): number {
  return fileLineCount(file) * ROW_HEIGHT + 40;
}

function estimatedHeight(file: PatchFile, collapsed: boolean): number {
  if (file.isBinary || file.hunks.length === 0) return 60;
  if (collapsed) return 120; // collapsed placeholder is short
  return expandedHeight(file);
}

export function displayPath(file: PatchFile): string {
  if (file.status === 'deleted') return file.oldPath ?? '(deleted)';
  return file.newPath ?? file.oldPath ?? '(unknown)';
}

export function statusSymbol(status: FileStatus): string {
  return STATUS_SYMBOL[status];
}

/**
 * Render all file cards into a fragment, in `order` (defaults to file order).
 * Section ids stay tied to the original file index so sidebar links keep
 * working regardless of the visual order.
 */
export function renderFiles(
  files: PatchFile[],
  mode: ViewMode = 'split',
  order: number[] = files.map((_, i) => i),
  opts: RenderOptions = {},
): DocumentFragment {
  const frag = document.createDocumentFragment();
  for (const i of order) frag.append(renderFile(files[i], i, mode, opts));
  return frag;
}

/**
 * Render one section per file, indexed by original file index (not visual
 * order). Callers order the sections themselves, so a layout switch only has to
 * reorder existing nodes instead of rebuilding the whole diff.
 */
export function renderFileSections(
  files: PatchFile[],
  mode: ViewMode = 'split',
  opts: RenderOptions = {},
): HTMLElement[] {
  return files.map((file, i) => renderFile(file, i, mode, opts));
}

function renderFile(file: PatchFile, index: number, mode: ViewMode, opts: RenderOptions): HTMLElement {
  const header = el('div', { class: 'gpv-file-header' }, [
    el('span', { class: `gpv-file-status ${file.status}`, text: statusSymbol(file.status) }),
    file.status === 'renamed' && file.oldPath && file.newPath
      ? el('span', {}, [
          el('span', { class: 'rename', text: `${file.oldPath} → ` }),
          el('span', { class: 'path', text: file.newPath }),
        ])
      : el('span', { class: 'path', text: displayPath(file) }),
  ]);

  // Oversized files collapse unless the user already expanded this one; keeping
  // that opt-in in `opts.expanded` lets a view-mode rebuild preserve it.
  const collapsed =
    !file.isBinary && file.hunks.length > 0 && isFileOversized(file) && !opts.expanded?.has(index);

  const children: Node[] = [header];
  if (file.isBinary) {
    children.push(el('div', { class: 'gpv-binary', text: 'Binary file — no textual diff.' }));
  } else if (file.hunks.length === 0) {
    children.push(el('div', { class: 'gpv-empty-hunks', text: 'No changes to display.' }));
  } else if (collapsed) {
    children.push(renderCollapsedFile(file, index, mode, opts));
  } else {
    for (const hunk of file.hunks) children.push(renderHunk(hunk, mode));
  }

  const section = el('section', { class: 'gpv-file', id: fileDomId(index) }, children);
  section.style.setProperty('contain-intrinsic-size', `auto ${estimatedHeight(file, collapsed)}px`);
  return section;
}

/**
 * Placeholder for an oversized file: keeps the initial mount cheap and lets the
 * user opt into the (potentially heavy) render. Hunks are built lazily under
 * the word-diff guard and per-line truncation, so even "Render anyway" is bounded.
 */
function renderCollapsedFile(
  file: PatchFile,
  index: number,
  mode: ViewMode,
  opts: RenderOptions,
): HTMLElement {
  const placeholder = el('div', { class: 'gpv-large-file' }, [
    el('span', {
      class: 'gpv-large-file-msg',
      text: `Large diff not rendered — ${formatBytes(fileByteSize(file))}`,
    }),
  ]);
  const btn = el('button', { class: 'gpv-btn', type: 'button', text: 'Render anyway' });
  btn.addEventListener('click', () => {
    opts.onExpand?.(index);
    const section = placeholder.closest('.gpv-file') as HTMLElement | null;
    const frag = document.createDocumentFragment();
    for (const hunk of file.hunks) frag.append(renderHunk(hunk, mode));
    placeholder.replaceWith(frag);
    // The reserved estimate was for the collapsed placeholder; refresh it to the
    // expanded content so content-visibility doesn't jump if it scrolls away.
    section?.style.setProperty('contain-intrinsic-size', `auto ${expandedHeight(file)}px`);
  });
  placeholder.append(btn);
  return placeholder;
}

// Alignment (and its word-level LCS) is pure and depends only on the hunk, so
// memoize per hunk and mode. Switching view/layout then rebuilds DOM without
// recomputing diffs. Hunk objects are stable for the lifetime of a model.
const splitCache = new WeakMap<Hunk, SplitRow[]>();
const unifiedCache = new WeakMap<Hunk, UnifiedRow[]>();

function alignSplitCached(hunk: Hunk): SplitRow[] {
  let rows = splitCache.get(hunk);
  if (!rows) {
    rows = alignHunk(hunk);
    splitCache.set(hunk, rows);
  }
  return rows;
}

function alignUnifiedCached(hunk: Hunk): UnifiedRow[] {
  let rows = unifiedCache.get(hunk);
  if (!rows) {
    rows = alignHunkUnified(hunk);
    unifiedCache.set(hunk, rows);
  }
  return rows;
}

function renderHunk(hunk: Hunk, mode: ViewMode): HTMLElement {
  const headerText = `@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@${
    hunk.header ? ' ' + hunk.header : ''
  }`;
  const rows =
    mode === 'unified'
      ? renderUnifiedRows(alignUnifiedCached(hunk))
      : renderSplitRows(alignSplitCached(hunk));

  return el('div', { class: 'gpv-hunk' }, [
    el('div', { class: 'gpv-hunk-header', text: headerText }),
    rows,
  ]);
}

/* ---- split view ---- */

function renderSplitRows(rows: SplitRow[]): HTMLElement {
  const container = el('div', { class: 'gpv-rows split' });
  for (const row of rows) {
    container.append(sideNum(row.left, 'oldNumber'));
    container.append(sideCode(row.left, 'remove', row.leftSegments));
    container.append(sideNum(row.right, 'newNumber'));
    container.append(sideCode(row.right, 'add', row.rightSegments));
  }
  return container;
}

function sideNum(line: DiffLine | null, field: 'oldNumber' | 'newNumber'): HTMLElement {
  if (!line) return el('div', { class: 'gpv-num gpv-cell-empty' });
  const kindClass = line.kind === 'context' ? '' : ` ${line.kind}`;
  const n = line[field];
  return el('div', { class: `gpv-num${kindClass}`, text: n == null ? '' : String(n) });
}

function sideCode(
  line: DiffLine | null,
  changeKind: 'add' | 'remove',
  segments: Segment[] | null,
): HTMLElement {
  if (!line) return el('div', { class: 'gpv-code gpv-cell-empty' });
  const kindClass = line.kind === 'context' ? '' : ` ${changeKind}`;
  return codeCell(`gpv-code${kindClass}`, line.text, segments);
}

/* ---- unified view ---- */

function renderUnifiedRows(rows: UnifiedRow[]): HTMLElement {
  const container = el('div', { class: 'gpv-rows unified' });
  for (const { line, segments } of rows) {
    const kindClass = line.kind === 'context' ? '' : ` ${line.kind}`;
    container.append(
      el('div', {
        class: `gpv-num${kindClass}`,
        text: line.oldNumber == null ? '' : String(line.oldNumber),
      }),
    );
    container.append(
      el('div', {
        class: `gpv-num${kindClass}`,
        text: line.newNumber == null ? '' : String(line.newNumber),
      }),
    );
    container.append(codeCell(`gpv-code${kindClass}`, line.text, segments, marker(line.kind)));
  }
  return container;
}

function marker(kind: DiffLine['kind']): string {
  if (kind === 'add') return '+';
  if (kind === 'remove') return '-';
  return ' ';
}

/* ---- shared ---- */

// Formats an approximate size (UTF-16 code-unit count; ≈ bytes for ASCII).
function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

function codeCell(
  className: string,
  text: string,
  segments: Segment[] | null,
  prefix?: string,
): HTMLElement {
  const cell = el('div', { class: className });
  if (prefix) cell.append(el('span', { class: 'gpv-marker', text: prefix }));
  if (segments) {
    for (const seg of segments) {
      cell.append(
        seg.kind === 'changed'
          ? el('span', { class: 'gpv-seg-changed', text: seg.text })
          : document.createTextNode(seg.text),
      );
    }
  } else if (text.length > MAX_RENDER_LINE) {
    // A single pathological line (e.g. minified bundle) would otherwise wrap
    // into millions of visual rows; cap it and note the true size.
    cell.append(document.createTextNode(text.slice(0, MAX_RENDER_LINE)));
    cell.append(
      el('span', {
        class: 'gpv-line-truncated',
        text: ` … line truncated (${formatBytes(text.length)})`,
      }),
    );
  } else {
    cell.append(document.createTextNode(text));
  }
  return cell;
}
