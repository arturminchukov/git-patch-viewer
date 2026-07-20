// Background service worker: registers the in-page "View patch" button injector
// for the hosts the user has granted, and unregisters it once the last one is
// revoked. State derives from the granted permissions, so the button keeps
// appearing automatically across sessions once the user has enabled it.

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
  const matches: string[] = [];

  if (await chrome.permissions.contains({ origins: OPTIONAL_ORIGINS })) {
    matches.push(...BUTTON_MATCHES);
  }
  for (const host of GITEA_HOSTS) {
    if (await chrome.permissions.contains({ origins: [giteaOrigin(host)] })) {
      matches.push(...giteaButtonMatches(host));
    }
  }
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
