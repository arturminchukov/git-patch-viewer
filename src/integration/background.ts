// Background service worker: registers the in-page "View patch" button injector
// whenever the optional host permission is present, and unregisters it when
// revoked. State derives from the granted permission, so the button keeps
// appearing automatically across sessions once the user has enabled it.

import { BUTTON_MATCHES, OPTIONAL_ORIGINS } from './hosts';

const INJECT_ID = 'gpv-inject-button';

function hasIntegration(): Promise<boolean> {
  return chrome.permissions.contains({ origins: OPTIONAL_ORIGINS });
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

async function register(): Promise<void> {
  await unregister(); // avoid duplicate-id errors
  try {
    await chrome.scripting.registerContentScripts([
      {
        id: INJECT_ID,
        matches: BUTTON_MATCHES,
        js: ['inject-button.js'],
        runAt: 'document_idle',
      },
    ]);
  } catch (err) {
    console.error('[git-patch-viewer] register failed', err);
  }
}

async function sync(): Promise<void> {
  if (await hasIntegration()) await register();
  else await unregister();
}

chrome.runtime.onInstalled.addListener(() => void sync());
chrome.runtime.onStartup.addListener(() => void sync());
chrome.permissions.onAdded.addListener(() => void sync());
chrome.permissions.onRemoved.addListener(() => void sync());
