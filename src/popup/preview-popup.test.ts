// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { initPreviewPopup } from './preview-popup';
import { PREVIEW_ORIGINS_KEY } from '../integration/preview-policy';

it('explicitly opts the current site in and out without revoking shared integration grants', async () => {
  document.body.innerHTML = '<p id="preview-site"></p><p id="preview-status"></p><button id="preview-toggle"></button>';
  let origins: string[] = [];
  const request = vi.fn(async () => true);
  const remove = vi.fn();
  vi.stubGlobal('chrome', {
    tabs: { query: async () => [{ url: 'https://example.org/list' }] },
    permissions: { contains: async () => true, request, remove },
    storage: { local: { get: async () => ({ [PREVIEW_ORIGINS_KEY]: origins }), set: async (value: Record<string, string[]>) => { origins = value[PREVIEW_ORIGINS_KEY]; } } },
  });
  await initPreviewPopup();
  const button = document.getElementById('preview-toggle')!;
  expect(button.dataset.on).toBe('false');
  button.click();
  expect(request).toHaveBeenCalledWith({ origins: ['https://example.org/*'] });
  await vi.waitFor(() => expect(button.dataset.on).toBe('true'));
  expect(origins).toEqual(['https://example.org']);
  button.click();
  await vi.waitFor(() => expect(button.dataset.on).toBe('false'));
  expect(origins).toEqual([]);
  expect(remove).not.toHaveBeenCalled();
});
