// Parse raw git patch / diff text into a PatchModel.
// Pure functions only — no DOM, no I/O, fully unit-testable.

import type {
  CommitMeta,
  DiffLine,
  FileStatus,
  Hunk,
  PatchFile,
  PatchModel,
} from './types';

const DIFF_GIT_PREFIX = 'diff --git ';
const HUNK_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/;

/**
 * Parse a full patch. Accepts both `git format-patch` output (with a mail
 * header) and plain `git diff` output (file diffs only).
 */
export function parse(raw: string): PatchModel {
  const text = raw.replace(/\r\n/g, '\n');
  const lines = text.split('\n');

  const firstDiffIndex = lines.findIndex((l) => l.startsWith(DIFF_GIT_PREFIX));
  const headerLines = firstDiffIndex === -1 ? lines : lines.slice(0, firstDiffIndex);
  const bodyLines = firstDiffIndex === -1 ? [] : lines.slice(firstDiffIndex);

  return {
    commit: parseCommitMeta(headerLines),
    files: parseFiles(bodyLines),
  };
}

/** Parse the `From <sha> / From: / Date: / Subject:` mail header, if present. */
function parseCommitMeta(headerLines: string[]): CommitMeta | null {
  if (headerLines.length === 0) return null;

  const shaMatch = headerLines[0].match(/^From ([0-9a-f]{7,40}) /);
  let author: string | null = null;
  let date: string | null = null;
  let subject: string | null = null;

  let i = 0;
  for (; i < headerLines.length; i++) {
    const line = headerLines[i];
    if (line.startsWith('From: ')) {
      author = line.slice('From: '.length).trim();
    } else if (line.startsWith('Date: ')) {
      date = line.slice('Date: '.length).trim();
    } else if (line.startsWith('Subject: ')) {
      // Subject may wrap across following continuation lines (indented).
      const parts = [line.slice('Subject: '.length)];
      while (i + 1 < headerLines.length && /^\s+\S/.test(headerLines[i + 1])) {
        parts.push(headerLines[++i].trim());
      }
      subject = parts.join(' ').replace(/^\[PATCH[^\]]*\]\s*/, '').trim();
      i++;
      break;
    }
  }

  // Everything after the subject block until the `---` separator is the body.
  const bodyParts: string[] = [];
  for (; i < headerLines.length; i++) {
    if (headerLines[i].trimEnd() === '---') break;
    bodyParts.push(headerLines[i]);
  }
  const body = bodyParts.join('\n').trim() || null;

  if (!shaMatch && !author && !subject) return null;
  return {
    sha: shaMatch ? shaMatch[1] : null,
    author,
    date,
    subject,
    body,
  };
}

/** Split the diff region into per-file blocks and parse each. */
function parseFiles(bodyLines: string[]): PatchFile[] {
  const files: PatchFile[] = [];
  let current: string[] | null = null;

  for (const line of bodyLines) {
    if (line.startsWith(DIFF_GIT_PREFIX)) {
      if (current) files.push(parseFile(current));
      current = [line];
    } else if (current) {
      current.push(line);
    }
  }
  if (current) files.push(parseFile(current));
  return files;
}

function parseFile(block: string[]): PatchFile {
  let oldPath: string | null = null;
  let newPath: string | null = null;
  let status: FileStatus = 'modified';
  let isBinary = false;

  const gitMatch = block[0].match(/^diff --git a\/(.+) b\/(.+)$/);
  if (gitMatch) {
    oldPath = gitMatch[1];
    newPath = gitMatch[2];
  }

  let hunkStart = block.length;
  for (let i = 1; i < block.length; i++) {
    const line = block[i];
    if (line.startsWith('new file mode')) status = 'added';
    else if (line.startsWith('deleted file mode')) status = 'deleted';
    else if (line.startsWith('rename from')) {
      status = 'renamed';
      oldPath = line.slice('rename from '.length);
    } else if (line.startsWith('rename to')) {
      status = 'renamed';
      newPath = line.slice('rename to '.length);
    } else if (line.startsWith('--- ')) {
      oldPath = normalizePath(line.slice(4));
    } else if (line.startsWith('+++ ')) {
      newPath = normalizePath(line.slice(4));
    } else if (line.startsWith('Binary files') || line.startsWith('GIT binary patch')) {
      isBinary = true;
      status = status === 'modified' ? 'binary' : status;
    } else if (line.startsWith('@@')) {
      hunkStart = i;
      break;
    }
  }

  const hunks = isBinary ? [] : parseHunks(block.slice(hunkStart));
  const { additions, deletions } = countChanges(hunks);

  return { oldPath, newPath, status, hunks, additions, deletions, isBinary };
}

/** Strip the `a/` or `b/` prefix and map `/dev/null` to null. */
function normalizePath(raw: string): string | null {
  const p = raw.trim();
  if (p === '/dev/null') return null;
  return p.replace(/^[ab]\//, '');
}

function parseHunks(lines: string[]): Hunk[] {
  const hunks: Hunk[] = [];
  let current: Hunk | null = null;
  let oldNumber = 0;
  let newNumber = 0;

  for (const line of lines) {
    const hm = line.match(HUNK_RE);
    if (hm) {
      if (current) hunks.push(current);
      const oldStart = Number(hm[1]);
      const oldCount = hm[2] === undefined ? 1 : Number(hm[2]);
      const newStart = Number(hm[3]);
      const newCount = hm[4] === undefined ? 1 : Number(hm[4]);
      current = {
        header: hm[5].trim(),
        oldStart,
        oldCount,
        newStart,
        newCount,
        lines: [],
      };
      oldNumber = oldStart;
      newNumber = newStart;
      continue;
    }
    if (!current) continue;

    // "\ No newline at end of file" is metadata, not a content line.
    if (line.startsWith('\\')) continue;

    const marker = line[0];
    const content = line.slice(1);
    if (marker === '+') {
      current.lines.push(line1('add', content, null, newNumber++));
    } else if (marker === '-') {
      current.lines.push(line1('remove', content, oldNumber++, null));
    } else {
      // Context line (leading space) or empty line inside the hunk.
      current.lines.push(line1('context', content, oldNumber++, newNumber++));
    }
  }
  if (current) hunks.push(current);
  return hunks;
}

function line1(
  kind: DiffLine['kind'],
  text: string,
  oldNumber: number | null,
  newNumber: number | null,
): DiffLine {
  return { kind, text, oldNumber, newNumber };
}

function countChanges(hunks: Hunk[]): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;
  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (line.kind === 'add') additions++;
      else if (line.kind === 'remove') deletions++;
    }
  }
  return { additions, deletions };
}
