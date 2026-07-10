// Build DOM for the diff content area from a PatchModel. No I/O; given a model
// it returns nodes. Alignment/word-diff comes from core/align.

import {
  alignHunk,
  alignHunkUnified,
  type Segment,
  type SplitRow,
  type UnifiedRow,
} from '../core/align';
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

export function displayPath(file: PatchFile): string {
  if (file.status === 'deleted') return file.oldPath ?? '(deleted)';
  return file.newPath ?? file.oldPath ?? '(unknown)';
}

export function statusSymbol(status: FileStatus): string {
  return STATUS_SYMBOL[status];
}

/** Render all file cards into a fragment. */
export function renderFiles(files: PatchFile[], mode: ViewMode = 'split'): DocumentFragment {
  const frag = document.createDocumentFragment();
  files.forEach((file, i) => frag.append(renderFile(file, i, mode)));
  return frag;
}

function renderFile(file: PatchFile, index: number, mode: ViewMode): HTMLElement {
  const header = el('div', { class: 'gpv-file-header' }, [
    el('span', { class: `gpv-file-status ${file.status}`, text: statusSymbol(file.status) }),
    file.status === 'renamed' && file.oldPath && file.newPath
      ? el('span', {}, [
          el('span', { class: 'rename', text: `${file.oldPath} → ` }),
          el('span', { class: 'path', text: file.newPath }),
        ])
      : el('span', { class: 'path', text: displayPath(file) }),
  ]);

  const children: Node[] = [header];
  if (file.isBinary) {
    children.push(el('div', { class: 'gpv-binary', text: 'Binary file — no textual diff.' }));
  } else if (file.hunks.length === 0) {
    children.push(el('div', { class: 'gpv-empty-hunks', text: 'No changes to display.' }));
  } else {
    for (const hunk of file.hunks) children.push(renderHunk(hunk, mode));
  }

  return el('section', { class: 'gpv-file', id: fileDomId(index) }, children);
}

function renderHunk(hunk: Hunk, mode: ViewMode): HTMLElement {
  const headerText = `@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@${
    hunk.header ? ' ' + hunk.header : ''
  }`;
  const rows =
    mode === 'unified'
      ? renderUnifiedRows(alignHunkUnified(hunk))
      : renderSplitRows(alignHunk(hunk));

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
  } else {
    cell.append(document.createTextNode(text));
  }
  return cell;
}
