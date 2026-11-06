import { expect, it, vi } from 'vitest';
import { syncPreviewScripts } from './preview-registration';
import { PREVIEW_ORIGINS_KEY } from './preview-policy';

it('registers a separate click interceptor only on explicitly enabled permitted origins and activates open pages', async () => {
  const register = vi.fn(async () => {});
  const execute = vi.fn(async () => []);
  vi.stubGlobal('chrome', {
    storage: { local: { get: async () => ({ [PREVIEW_ORIGINS_KEY]: ['https://example.org'] }) } },
    permissions: { contains: async () => true },
    scripting: { getRegisteredContentScripts: async () => [{ id: 'gpv-inject-button' }], registerContentScripts: register, executeScript: execute },
    tabs: { query: async () => [{ id: 4, url: 'https://example.org/page' }] },
  });
  await syncPreviewScripts();
  expect(register).toHaveBeenCalledWith([{ id: 'gpv-preview-links', matches: ['https://example.org/*'], js: ['preview-links.js'], runAt: 'document_idle' }]);
  expect(execute).toHaveBeenCalledWith({ target: { tabId: 4 }, files: ['preview-links.js'] });
});
