// Dynamically registered only for opted-in source sites. No patch fetching here.
import { PREVIEW_ORIGINS_KEY } from '../integration/preview-policy';
import { createPreviewClicks } from './preview-clicks';

const marker = '__gpvPreviewLinks';
const state = globalThis as typeof globalThis & { __gpvPreviewLinks?: () => Promise<void> };

if (state[marker]) {
  void state[marker]();
} else {
  let origins: string[] = [];
  const refresh = async () => {
    // Clear immediately so a disabled site cannot keep using a stale cache.
    origins = [];
    try {
      const result = await chrome.runtime.sendMessage({ type: 'preview:config' });
      origins = Array.isArray(result?.origins) ? result.origins : [];
    } catch {
      // Leave links native when the extension context is unavailable.
    }
  };
  const clicks = createPreviewClicks(() => origins, (url, intent) =>
    chrome.runtime.sendMessage({ type: 'preview:open', url, intent }),
  );
  state[marker] = refresh;
  document.addEventListener('click', clicks.click);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[PREVIEW_ORIGINS_KEY]) void refresh();
  });
  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (sender.id !== chrome.runtime.id) return;
    if (message?.type === 'preview:replay' && typeof message.intent === 'string') {
      reply({ replayed: clicks.replay(message.intent) });
    }
    if (message?.type === 'preview:discard' && typeof message.intent === 'string') {
      clicks.discard(message.intent);
    }
    if (message?.type === 'preview:refresh') void refresh();
  });
  void refresh();
}
