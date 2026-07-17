// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderFiles } from '../ui/render';
import { parse } from './parser';

// A single ~6 MB line stands in for the real 17.5 MB minified bundle lines.
const giant = 'x'.repeat(6_000_000);
const raw = [
  'diff --git a/dist/index.js b/dist/index.js',
  'index 0000000..1111111 100644',
  '--- a/dist/index.js',
  '+++ b/dist/index.js',
  '@@ -1 +1 @@',
  '-' + giant,
  '+' + giant + 'y',
].join('\n');

describe('giant-line patch resilience', () => {
  it('parses and renders collapsed without OOM, no rows/LCS', () => {
    const model = parse(raw);
    const frag = renderFiles(model.files);
    const host = document.createElement('div');
    host.append(frag);

    // File is collapsed; no rows built, so the O(n·m) LCS never runs and the
    // 6 MB line is never laid out. Completing this test at all proves no OOM.
    expect(host.querySelector('.gpv-large-file')).not.toBeNull();
    expect(host.querySelector('.gpv-rows')).toBeNull();
  });
});
