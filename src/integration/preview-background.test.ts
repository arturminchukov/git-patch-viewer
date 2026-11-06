import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handlePreviewMessage } from './preview-background';
import { PREVIEW_ORIGINS_KEY, PREVIEW_PENDING_KEY } from './preview-policy';

const url = 'https://example.org/a.patch';
const source: chrome.runtime.MessageSender = { id: 'ext', url: 'https://example.org/page', frameId: 0, tab: { id: 4 } as chrome.tabs.Tab };
const viewer: chrome.runtime.MessageSender = { id: 'ext', frameId: 0, url: 'chrome-extension://ext/viewer.html', tab: { id: 8 } as chrome.tabs.Tab };
let data: Record<string, unknown>;
let api: typeof chrome;

beforeEach(() => {
  data = { [PREVIEW_ORIGINS_KEY]: ['https://example.org'] };
  api = {
    runtime: { id: 'ext', getURL: (path: string) => 'chrome-extension://ext/' + path },
    storage: {
      local: { get: vi.fn(async (key: string) => ({ [key]: data[key] })), set: vi.fn(async (values: object) => Object.assign(data, values)) },
      session: { get: vi.fn(async (key: string) => ({ [key]: data[key] })), set: vi.fn(async (values: object) => Object.assign(data, values)) },
    },
    permissions: { contains: vi.fn(async () => true) },
    tabs: { create: vi.fn(async () => ({ id: 8 })), update: vi.fn(async () => ({})), sendMessage: vi.fn(async () => ({ replayed: true })) },
  } as unknown as typeof chrome;
  vi.stubGlobal('chrome', api);
});

describe('download preview lifecycle', () => {
  it('denies untrusted owners, frames, disabled sources and unpermitted destinations', async () => {
    const message = { type: 'preview:open', url, intent: 'click-1' };
    for (const sender of [{ ...source, id: 'foreign' }, { ...source, frameId: 1 }, { ...source, url: 'https://other.org/page' }]) {
      const result = await handlePreviewMessage(message, sender) as { opened?: boolean };
      expect(result.opened).not.toBe(true);
    }
    expect(await handlePreviewMessage({ ...message, url: 'https://other.org/a.patch' }, source)).toEqual({ opened: false });
    api.permissions.contains = vi.fn(async () => false) as typeof chrome.permissions.contains;
    expect(await handlePreviewMessage(message, source)).toEqual({ opened: false });
    expect(api.tabs.create).not.toHaveBeenCalled();
  });
  it('rejects forged viewer claims and ignores caller-supplied fallback tab IDs', async () => {
    await handlePreviewMessage({ type: 'preview:open', url, intent: 'click-1' }, source);
    const entries = data[PREVIEW_PENDING_KEY] as { request: string }[];
    const request = entries[0].request;
    for (const sender of [source, { ...viewer, frameId: 1 }, { ...viewer, tab: { id: 999 } as chrome.tabs.Tab }, { ...viewer, url: 'https://example.org/viewer.html' }]) {
      expect(await handlePreviewMessage({ type: 'preview:failed', request, tabId: 999 }, sender)).toEqual({ allowed: false });
    }
    expect(await handlePreviewMessage({ type: 'preview:claim', request, url: 'https://elsewhere.org/a.patch' }, viewer)).toEqual({ allowed: false });
    expect(api.tabs.sendMessage).not.toHaveBeenCalled();
    vi.mocked(api.tabs.sendMessage).mockRejectedValue(new Error('source closed'));
    expect(await handlePreviewMessage({ type: 'preview:failed', request, tabId: 999 }, viewer)).toEqual({ replayed: false });
    expect(api.tabs.sendMessage).toHaveBeenCalledWith(4, expect.anything(), { frameId: 0 });
  });
  it('rejects expired requests and rechecks opt-in before authorizing fetch', async () => {
    await handlePreviewMessage({ type: 'preview:open', url, intent: 'click-1' }, source);
    const entries = data[PREVIEW_PENDING_KEY] as { request: string; expires: number }[];
    const request = entries[0].request;
    data[PREVIEW_ORIGINS_KEY] = [];
    expect(await handlePreviewMessage({ type: 'preview:claim', request, url }, viewer)).toEqual({ allowed: false });
    data[PREVIEW_ORIGINS_KEY] = ['https://example.org'];
    entries[0].expires = 0;
    expect(await handlePreviewMessage({ type: 'preview:failed', request }, viewer)).toEqual({ allowed: false });
    expect(api.tabs.sendMessage).not.toHaveBeenCalled();
  });
  it('persists a single-use claim while retaining metadata for owner failure', async () => {
    await handlePreviewMessage({ type: 'preview:open', url, intent: 'click-1' }, source);
    const entry = (data[PREVIEW_PENDING_KEY] as { request: string; claimed: boolean }[])[0];
    expect(entry.claimed).toBe(false);
    const claim = { type: 'preview:claim', request: entry.request, url };
    expect(await handlePreviewMessage({ ...claim, url: 'https://elsewhere.org/a.patch' }, viewer)).toEqual({ allowed: false });
    expect(entry.claimed).toBe(false);
    vi.mocked(api.storage.session.set).mockClear();
    expect(await handlePreviewMessage(claim, viewer)).toEqual({ allowed: true });
    expect(api.storage.session.set).toHaveBeenCalledOnce();
    expect(api.storage.session.set).toHaveBeenCalledWith({ [PREVIEW_PENDING_KEY]: [expect.objectContaining({ request: entry.request, claimed: true })] });
    expect((data[PREVIEW_PENDING_KEY] as { claimed: boolean }[])[0].claimed).toBe(true);
    expect(await handlePreviewMessage(claim, viewer)).toEqual({ allowed: false });
    expect(await handlePreviewMessage({ type: 'preview:failed', request: entry.request }, viewer)).toEqual({ replayed: true });
    expect(api.tabs.sendMessage).toHaveBeenCalledWith(4, { type: 'preview:replay', intent: 'click-1' }, { frameId: 0 });
  });
  it('discards the recorded source intent after completion, even if the source is gone', async () => {
    for (const sourceGone of [false, true]) {
      await handlePreviewMessage({ type: 'preview:open', url, intent: 'click-1' }, source);
      const request = (data[PREVIEW_PENDING_KEY] as { request: string }[])[0].request;
      await handlePreviewMessage({ type: 'preview:claim', request, url }, viewer);
      if (sourceGone) vi.mocked(api.tabs.sendMessage).mockRejectedValue(new Error('source closed'));
      expect(await handlePreviewMessage({ type: 'preview:complete', request }, viewer)).toEqual({ completed: true });
      expect(api.tabs.sendMessage).toHaveBeenLastCalledWith(4, { type: 'preview:discard', intent: 'click-1' }, { frameId: 0 });
      expect(data[PREVIEW_PENDING_KEY]).toEqual([]);
      expect(await handlePreviewMessage({ type: 'preview:failed', request }, viewer)).toEqual({ allowed: false });
    }
  });
  it('keeps at most 32 small metadata records, never patch content', async () => {
    for (let i = 0; i < 35; i++) await handlePreviewMessage({ type: 'preview:open', url, intent: `click-${i}` }, source);
    const entries = data[PREVIEW_PENDING_KEY] as object[];
    expect(entries).toHaveLength(32);
    expect(Object.keys(entries[0]).sort()).toEqual(['claimed', 'expires', 'intent', 'request', 'sourceOrigin', 'sourceTab', 'url', 'viewerTab']);
  });
  it('opens a bound extension viewer, authorizes its fetch and replays failure only in its source tab', async () => {
    expect(await handlePreviewMessage({ type: 'preview:open', url, intent: 'click-1' }, source)).toEqual({ opened: true });
    const update = vi.mocked(api.tabs.update).mock.calls[0];
    expect(update[0]).toBe(8);
    const target = new URL((update[1] as chrome.tabs.UpdateProperties).url!);
    expect(target.pathname).toBe('/viewer.html');
    expect(target.searchParams.get('url')).toBe(url);
    const request = target.searchParams.get('request');
    expect(await handlePreviewMessage({ type: 'preview:claim', request, url }, viewer)).toEqual({ allowed: true });
    expect(await handlePreviewMessage({ type: 'preview:failed', request }, viewer)).toEqual({ replayed: true });
    expect(api.tabs.sendMessage).toHaveBeenCalledWith(4, { type: 'preview:replay', intent: 'click-1' }, { frameId: 0 });
    expect(data[PREVIEW_PENDING_KEY]).toEqual([]);
    expect(api.storage.session.set).toHaveBeenCalled();
    expect(api.storage.local.set).not.toHaveBeenCalled();
  });
});
