import { describe, expect, it } from 'vitest';
import { parse } from './parser';

const FORMAT_PATCH = `From a07be73315ab99e4e7f53f431b07d4caa728a302 Mon Sep 17 00:00:00 2001
From: Artur Minchukou <aminchukov@victoriametrics.com>
Date: Fri, 10 Jul 2026 11:15:08 +0400
Subject: [PATCH] fix(raw logs): restore the \`_stream\` label in log query
 results (#685)

The backend deleted the field.

Keep it.
---
 CHANGELOG.md |  1 +
 file.go      |  2 +-
 2 files changed, 2 insertions(+), 1 deletion(-)

diff --git a/CHANGELOG.md b/CHANGELOG.md
index bb937fe4..64e2b58e 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -5,6 +5,7 @@
 * FEATURE: existing line
+* BUGFIX: restore the label. See pr #685.
 * BUGFIX: another line
diff --git a/file.go b/file.go
index db711178..5436d961 100644
--- a/file.go
+++ b/file.go
@@ -194,7 +194,7 @@ func TestSomething(t *testing.T) {
 	unchanged := 1
-	old := "a"
+	new := "b"
 	trailing := 2
`;

describe('parse — commit metadata', () => {
  const model = parse(FORMAT_PATCH);

  it('extracts sha, author, date', () => {
    expect(model.commit?.sha).toBe('a07be73315ab99e4e7f53f431b07d4caa728a302');
    expect(model.commit?.author).toBe('Artur Minchukou <aminchukov@victoriametrics.com>');
    expect(model.commit?.date).toBe('Fri, 10 Jul 2026 11:15:08 +0400');
  });

  it('joins the wrapped subject and strips the [PATCH] prefix', () => {
    expect(model.commit?.subject).toBe(
      'fix(raw logs): restore the `_stream` label in log query results (#685)',
    );
  });

  it('captures the body between subject and the --- separator', () => {
    expect(model.commit?.body).toBe('The backend deleted the field.\n\nKeep it.');
  });
});

describe('parse — files and hunks', () => {
  const model = parse(FORMAT_PATCH);

  it('finds both files', () => {
    expect(model.files).toHaveLength(2);
    expect(model.files[0].newPath).toBe('CHANGELOG.md');
    expect(model.files[1].newPath).toBe('file.go');
  });

  it('counts additions and deletions per file', () => {
    expect(model.files[0].additions).toBe(1);
    expect(model.files[0].deletions).toBe(0);
    expect(model.files[1].additions).toBe(1);
    expect(model.files[1].deletions).toBe(1);
  });

  it('assigns correct old/new line numbers', () => {
    const hunk = model.files[1].hunks[0];
    expect(hunk.oldStart).toBe(194);
    expect(hunk.newStart).toBe(194);
    const removed = hunk.lines.find((l) => l.kind === 'remove');
    const added = hunk.lines.find((l) => l.kind === 'add');
    expect(removed).toMatchObject({ text: '\told := "a"', oldNumber: 195, newNumber: null });
    expect(added).toMatchObject({ text: '\tnew := "b"', oldNumber: null, newNumber: 195 });
  });
});

describe('parse — status detection', () => {
  it('detects added files', () => {
    const model = parse(`diff --git a/new.txt b/new.txt
new file mode 100644
index 0000000..e69de29
--- /dev/null
+++ b/new.txt
@@ -0,0 +1 @@
+hello
`);
    expect(model.files[0].status).toBe('added');
    expect(model.files[0].oldPath).toBeNull();
    expect(model.files[0].newPath).toBe('new.txt');
  });

  it('detects deleted files', () => {
    const model = parse(`diff --git a/old.txt b/old.txt
deleted file mode 100644
index e69de29..0000000
--- a/old.txt
+++ /dev/null
@@ -1 +0,0 @@
-bye
`);
    expect(model.files[0].status).toBe('deleted');
    expect(model.files[0].newPath).toBeNull();
  });

  it('detects renames', () => {
    const model = parse(`diff --git a/a.txt b/b.txt
similarity index 100%
rename from a.txt
rename to b.txt
`);
    expect(model.files[0].status).toBe('renamed');
    expect(model.files[0].oldPath).toBe('a.txt');
    expect(model.files[0].newPath).toBe('b.txt');
  });

  it('detects binary files', () => {
    const model = parse(`diff --git a/img.png b/img.png
index 1111111..2222222 100644
Binary files a/img.png and b/img.png differ
`);
    expect(model.files[0].isBinary).toBe(true);
    expect(model.files[0].hunks).toHaveLength(0);
  });
});

describe('parse — plain git diff without mail header', () => {
  const model = parse(`diff --git a/x.txt b/x.txt
index 111..222 100644
--- a/x.txt
+++ b/x.txt
@@ -1,2 +1,2 @@
 keep
-remove me
+add me
`);

  it('has no commit metadata', () => {
    expect(model.commit).toBeNull();
  });

  it('still parses the file', () => {
    expect(model.files).toHaveLength(1);
    expect(model.files[0].additions).toBe(1);
    expect(model.files[0].deletions).toBe(1);
  });
});
