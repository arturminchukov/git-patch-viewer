import { describe, expect, it, vi } from 'vitest';
import { fetchPatch } from './fetch-patch';

const raw = 'diff --git a/x b/x\n--- a/x\n+++ b/x\n@@ -1 +1 @@\n-old\n+new\n';
const url = 'https://example.org/a.patch';

describe('extension-context patch fetch', () => {
  it('rejects HTTP errors, HTML login pages and unsupported or malformed diffs', async () => {
    for (const response of [
      new Response(raw, { status: 403 }),
      new Response('<!doctype html><html>Login\n' + raw + '</html>'),
      new Response('--- a/x\n+++ b/x\n@@ -1 +1 @@\n-a\n+b'),
      new Response('diff --git nonsense\n'),
      new Response('diff --git a/x b/x\n'),
      new Response('<div>Sign in\n' + raw + '</div>'),
    ]) {
      await expect(fetchPatch(url, vi.fn().mockResolvedValue(response))).rejects.toThrow();
    }
  });
  it('rejects unsafe input and unexpected final redirect URLs', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(raw));
    await expect(fetchPatch('https://u:p@example.org/a.patch', fetcher)).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
    const response = new Response(raw);
    Object.defineProperty(response, 'url', { value: 'https://elsewhere.org/a.patch' });
    await expect(fetchPatch(url, vi.fn().mockResolvedValue(response))).rejects.toThrow();
  });
  it('aborts a stalled request within a bounded timeout', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn((_url, options) => new Promise<Response>((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    })) as typeof fetch;
    const result = expect(fetchPatch(url, fetcher)).rejects.toThrow('aborted');
    await vi.advanceTimersByTimeAsync(60_000);
    await result;
    vi.useRealTimers();
  });
  it('parses octet-stream and attachment responses without trusting MIME', async () => {
    for (const type of ['application/octet-stream', 'text/plain']) {
      const fetcher = vi.fn().mockResolvedValue(new Response(raw, { headers: { 'Content-Type': type, 'Content-Disposition': 'attachment; filename=a.patch' } }));
      const model = await fetchPatch(url, fetcher);
      expect(model.files[0].hunks[0].lines[1].text).toBe('new');
      expect(fetcher).toHaveBeenCalledWith(url, expect.objectContaining({ credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer', signal: expect.any(AbortSignal) }));
    }
  });
});
