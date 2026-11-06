import { httpUrl, originPattern, permittedOrigins } from './preview-policy';

const PREVIEW_SCRIPT_ID = 'gpv-preview-links';

export async function syncPreviewScripts(): Promise<void> {
  const origins = await permittedOrigins();
  const matches = [...new Set(origins.map(originPattern))];
  const scripts = await chrome.scripting.getRegisteredContentScripts();
  if (scripts.some((script) => script.id === PREVIEW_SCRIPT_ID)) {
    await chrome.scripting.unregisterContentScripts({ ids: [PREVIEW_SCRIPT_ID] });
  }
  if (!matches.length) return;
  await chrome.scripting.registerContentScripts([{
    id: PREVIEW_SCRIPT_ID, matches, js: ['preview-links.js'], runAt: 'document_idle',
  }]);
  // Also enable the page that is already open when the popup is used.
  const tabs = await chrome.tabs.query({ url: matches });
  await Promise.all(tabs.map(async (tab) => {
    const url = httpUrl(tab.url);
    if (tab.id === undefined || !url || !origins.includes(url.origin)) return;
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['preview-links.js'] });
    } catch {
      // A tab can navigate or close between query and injection.
    }
  }));
}
