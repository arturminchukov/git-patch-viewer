// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { runViewer } from './viewer';
import { PREVIEW_ORIGINS_KEY } from '../integration/preview-policy';

const url = 'https://example.org/a.patch';
const raw = 'diff --git a/x b/x\n--- a/x\n+++ b/x\n@@ -1 +1 @@\n-a\n+b';
let messages: ReturnType<typeof vi.fn>;

beforeEach(() => {
  document.body.replaceChildren();
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {} }));
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
  messages = vi.fn(async (message: { type: string }) => message.type === 'preview:claim' ? { allowed: true } : { replayed: false });
  vi.stubGlobal('chrome', { runtime: { sendMessage: messages }, permissions: { contains: async () => true }, storage: { local: { get: async () => ({ [PREVIEW_ORIGINS_KEY]: ['https://example.org'] }) } } });
  vi.stubGlobal('fetch', vi.fn(async () => new Response(raw, { headers: { 'Content-Type': 'application/octet-stream' } })));
});

it('fetches only after authorization and mounts the actual shared UI with a source link', async () => {
  await runViewer('https://extension.invalid/viewer.html?' + new URLSearchParams({ url, request: 'request-1' }));
  expect(messages.mock.calls[0][0]).toEqual({ type: 'preview:claim', url, request: 'request-1' });
  const shadow = document.getElementById('git-patch-viewer-host')!.shadowRoot!;
  expect(shadow.querySelector('.gpv-file')).not.toBeNull();
  expect(shadow.querySelector('a')?.getAttribute('href')).toBe(url);
  expect(messages).toHaveBeenCalledWith({ type: 'preview:complete', request: 'request-1' });
});

it('keeps a successfully rendered viewer if metadata cleanup messaging fails', async () => {
  messages.mockImplementation(async (message: { type: string }) => {
    if (message.type === 'preview:complete') throw new Error('worker suspended');
    return { allowed: true, replayed: false };
  });
  await runViewer('https://extension.invalid/viewer.html?' + new URLSearchParams({ url, request: 'request-1' }));
  expect(document.getElementById('git-patch-viewer-host')).not.toBeNull();
  expect(messages).not.toHaveBeenCalledWith({ type: 'preview:failed', request: 'request-1' });
});

it('does not fetch without authorization, retains ordinary URL action when source is gone', async () => {
  messages.mockResolvedValue({ allowed: false });
  await runViewer('https://extension.invalid/viewer.html?' + new URLSearchParams({ url, request: 'request-1' }));
  expect(fetch).not.toHaveBeenCalled();
  expect(document.getElementById('preview-original')?.getAttribute('href')).toBe(url);
  expect(document.getElementById('preview-download')?.hasAttribute('download')).toBe(true);
});

it('requests source replay on fetch failure, closing only its own viewer after confirmation', async () => {
  vi.mocked(fetch).mockRejectedValue(new Error('network failed'));
  messages.mockImplementation(async (message: { type: string }) => message.type === 'preview:claim' ? { allowed: true } : { replayed: true });
  const close = vi.spyOn(window, 'close').mockImplementation(() => {});
  await runViewer('https://extension.invalid/viewer.html?' + new URLSearchParams({ url, request: 'request-1' }));
  expect(messages).toHaveBeenCalledWith({ type: 'preview:failed', request: 'request-1' });
  expect(close).toHaveBeenCalledOnce();
});
