// Pure data model for a parsed git patch. No DOM, no I/O.

export type FileStatus =
  | 'added'
  | 'deleted'
  | 'modified'
  | 'renamed'
  | 'binary';

export type DiffLineKind = 'context' | 'add' | 'remove';

/** A single line inside a hunk. */
export interface DiffLine {
  kind: DiffLineKind;
  /** Text content without the leading +/-/space marker. */
  text: string;
  /** 1-based line number in the old file, or null for pure additions. */
  oldNumber: number | null;
  /** 1-based line number in the new file, or null for pure removals. */
  newNumber: number | null;
}

/** A contiguous change block, i.e. one `@@ ... @@` section. */
export interface Hunk {
  /** Raw section heading after the second `@@`, e.g. "func Foo()". */
  header: string;
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: DiffLine[];
}

/** One file's worth of changes. */
export interface PatchFile {
  oldPath: string | null;
  newPath: string | null;
  status: FileStatus;
  hunks: Hunk[];
  additions: number;
  deletions: number;
  /** True when the file is binary and has no textual hunks. */
  isBinary: boolean;
}

/** Optional commit metadata parsed from a `git format-patch` mail header. */
export interface CommitMeta {
  sha: string | null;
  author: string | null;
  date: string | null;
  subject: string | null;
  body: string | null;
}

export interface PatchModel {
  commit: CommitMeta | null;
  files: PatchFile[];
}
