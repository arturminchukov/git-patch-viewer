// Background service worker: registers the in-page "View patch" button injector
// for the hosts the user has granted, and unregisters it once the last one is
// revoked. State derives from the granted permissions, so the button keeps
// appearing automatically across sessions once the user has enabled it.

import { handlePreviewMessage } from './preview-background';
import { syncPreviewScripts } from './preview-registration';
import { permittedOrigins, PREVIEW_ORIGINS_KEY } from './preview-policy';
import {
  BUTTON_MATCHES,
  GITEA_HOSTS,
  OPTIONAL_ORIGINS,
  giteaButtonMatches,
  giteaOrigin,
} from './hosts';

const INJECT_ID = 'gpv-inject-button';

/**
 * Pages to inject into. Only granted hosts may appear: registering a match the
 * extension has no permission for makes the whole call fail.
 */
async function grantedMatches(): Promise<string[]> {
  const [core, ...gitea] = await Promise.all([
    chrome.permissions.contains({ origins: OPTIONAL_ORIGINS }),
    ...GITEA_HOSTS.map((host) => chrome.permissions.contains({ origins: [giteaOrigin(host)] })),
  ]);

  const matches: string[] = [];
  if (core) matches.push(...BUTTON_MATCHES);
  GITEA_HOSTS.forEach((host, i) => {
    if (gitea[i]) matches.push(...giteaButtonMatches(host));
  });
  return matches;
}

async function unregister(): Promise<void> {
  try {
    const existing = await chrome.scripting.getRegisteredContentScripts();
    if (existing.some((s) => s.id === INJECT_ID)) {
      await chrome.scripting.unregisterContentScripts({ ids: [INJECT_ID] });
    }
  } catch (err) {
    console.error('[git-patch-viewer] unregister failed', err);
  }
}

async function register(matches: string[]): Promise<void> {
  await unregister(); // avoid duplicate-id errors
  try {
    await chrome.scripting.registerContentScripts([
      {
        id: INJECT_ID,
        matches,
        js: ['inject-button.js'],
        runAt: 'document_idle',
      },
    ]);
  } catch (err) {
    console.error('[git-patch-viewer] register failed', err);
  }
}

async function sync(): Promise<void> {
  const matches = await grantedMatches();
  if (matches.length) await register(matches);
  else await unregister();
}

chrome.runtime.onInstalled.addListener(() => void sync());
chrome.runtime.onStartup.addListener(() => void sync());
chrome.permissions.onAdded.addListener(() => void sync());
chrome.permissions.onRemoved.addListener(() => void sync());

// Serialize metadata transactions and registration updates across concurrent
// clicks/popups. A worker restart reads the bounded pending records back.
let previewQueue: Promise<unknown> = Promise.resolve();
function queuePreview(task: () => Promise<unknown>): Promise<unknown> {
  const result = previewQueue.then(task);
  previewQueue = result.catch((err) => console.error('[git-patch-viewer] preview', err));
  return result;
}
function syncPreviews(): void {
  void queuePreview(syncPreviewScripts);
}
chrome.runtime.onInstalled.addListener(syncPreviews);
chrome.runtime.onStartup.addListener(syncPreviews);
chrome.permissions.onAdded.addListener(syncPreviews);
chrome.permissions.onRemoved.addListener(() => {
  void queuePreview(async () => {
    // Drop revoked origins from explicit opt-in and invalidate source caches.
    await chrome.storage.local.set({ [PREVIEW_ORIGINS_KEY]: await permittedOrigins() });
    await syncPreviewScripts();
  });
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[PREVIEW_ORIGINS_KEY]) syncPreviews();
});
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (!message || typeof message.type !== 'string' || !['preview:config', 'preview:open', 'preview:claim', 'preview:failed', 'preview:complete'].includes(message.type)) return false;
  void queuePreview(() => handlePreviewMessage(message, sender)).then(reply, () => reply({ allowed: false, opened: false, replayed: false }));
  return true;
});
