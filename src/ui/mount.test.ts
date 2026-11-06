// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { parse } from '../core/parser';
import { mountPatch } from './mount';

it('mounts the shared viewer with sidebar, resizer and view controls', async () => {
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {} }));
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
  const model = parse('diff --git a/x b/x\n--- a/x\n+++ b/x\n@@ -1 +1 @@\n-a\n+b');
  await mountPatch(model);
  const shadow = document.getElementById('git-patch-viewer-host')!.shadowRoot!;
  expect(shadow.querySelector('.gpv-resizer')).not.toBeNull();
  expect(shadow.querySelector('.gpv-file')).not.toBeNull();
  expect(shadow.querySelector('.gpv-sidebar')).not.toBeNull();
  const view = shadow.querySelector('.gpv-toolbar button') as HTMLButtonElement;
  view.click();
  expect(shadow.querySelector('.gpv-file')).not.toBeNull();
  expect(document.title).toBe('x');
  vi.unstubAllGlobals();
});
