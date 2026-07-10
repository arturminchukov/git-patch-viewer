import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from './parser';

// End-to-end check against the real-world sample patch shipped in demo/.
const samplePath = fileURLToPath(new URL('../../demo/sample.patch', import.meta.url));
const sample = readFileSync(samplePath, 'utf8');

describe('parse — real sample.patch', () => {
  const model = parse(sample);

  it('parses the commit subject', () => {
    expect(model.commit?.subject).toBe(
      'fix(raw logs): restore the `_stream` label in log query results (#685)',
    );
    expect(model.commit?.sha).toBe('a07be73315ab99e4e7f53f431b07d4caa728a302');
  });

  it('parses every file in the patch', () => {
    const paths = model.files.map((f) => f.newPath);
    expect(paths).toEqual([
      'CHANGELOG.md',
      'pkg/plugin/datasource_test.go',
      'pkg/plugin/response_logs.go',
      'pkg/plugin/response_logs_test.go',
    ]);
  });

  it('every file has at least one hunk and consistent line numbering', () => {
    for (const file of model.files) {
      expect(file.hunks.length).toBeGreaterThan(0);
      for (const hunk of file.hunks) {
        for (const line of hunk.lines) {
          if (line.kind === 'add') expect(line.newNumber).not.toBeNull();
          if (line.kind === 'remove') expect(line.oldNumber).not.toBeNull();
          if (line.kind === 'context') {
            expect(line.oldNumber).not.toBeNull();
            expect(line.newNumber).not.toBeNull();
          }
        }
      }
    }
  });
});
