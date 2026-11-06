import { httpUrl, patchLink, permittedOrigins, PREVIEW_LIMIT, PREVIEW_PENDING_KEY, PREVIEW_TTL } from './preview-policy';

interface PendingPreview {
  request: string;
  intent: string;
  url: string;
  sourceOrigin: string;
  sourceTab: number;
  viewerTab: number;
  claimed: boolean;
  expires: number;
}

async function pending(): Promise<PendingPreview[]> {
  const stored = await chrome.storage.session.get(PREVIEW_PENDING_KEY);
  const entries: PendingPreview[] = Array.isArray(stored[PREVIEW_PENDING_KEY]) ? stored[PREVIEW_PENDING_KEY] : [];
  return entries.filter((entry) => entry.expires > Date.now()).slice(-PREVIEW_LIMIT);
}

/** Small metadata only. Session storage survives worker suspension without
 * writing patch URLs to disk; supported by Chrome 102+ and Firefox 115+.
 * Entries expire and the collection is bounded. */
export async function handlePreviewMessage(message: Record<string, unknown>, sender: chrome.runtime.MessageSender): Promise<unknown> {
  if (sender.id !== chrome.runtime.id) return { allowed: false };
  const source = httpUrl(sender.url);
  const origins = await permittedOrigins();
  if (message.type === 'preview:config') {
    return { origins: source && sender.frameId === 0 && origins.includes(source.origin) ? origins : [] };
  }
  const entries = await pending();
  if (message.type === 'preview:open') {
    const target = httpUrl(message.url);
    if (!source || sender.frameId !== 0 || sender.tab?.id === undefined ||
        !target || !patchLink(message.url) || target.href.length > 16_384 ||
        !origins.includes(source.origin) || !origins.includes(target.origin) ||
        typeof message.intent !== 'string' || !/^[\w-]{1,64}$/.test(message.intent)) return { opened: false };
    const request = crypto.randomUUID();
    // Create blank first so a fast viewer cannot claim before its owner is saved.
    const tab = await chrome.tabs.create({ url: 'about:blank', active: true });
    if (tab.id === undefined) return { opened: false };
    entries.push({ request, intent: message.intent, url: target.href, sourceOrigin: source.origin,
      sourceTab: sender.tab.id, viewerTab: tab.id, claimed: false, expires: Date.now() + PREVIEW_TTL });
    await chrome.storage.session.set({ [PREVIEW_PENDING_KEY]: entries.slice(-PREVIEW_LIMIT) });
    const params = new URLSearchParams({ url: target.href, request });
    await chrome.tabs.update(tab.id, { url: chrome.runtime.getURL('viewer.html') + '?' + params });
    return { opened: true };
  }
  const entry = entries.find((item) => item.request === message.request);
  if (!entry || sender.frameId !== 0 || entry.viewerTab !== sender.tab?.id ||
      sender.url?.split(/[?#]/)[0] !== chrome.runtime.getURL('viewer.html')) return { allowed: false };
  if (message.type === 'preview:claim') {
    if (entry.claimed || message.url !== entry.url || !origins.includes(entry.sourceOrigin) ||
        !origins.includes(new URL(entry.url).origin)) return { allowed: false };
    entry.claimed = true;
    await chrome.storage.session.set({ [PREVIEW_PENDING_KEY]: entries });
    return { allowed: true };
  }
  if (message.type === 'preview:failed' || message.type === 'preview:complete') {
    await chrome.storage.session.set({ [PREVIEW_PENDING_KEY]: entries.filter((item) => item !== entry) });
    if (message.type === 'preview:complete') {
      try {
        await chrome.tabs.sendMessage(entry.sourceTab, { type: 'preview:discard', intent: entry.intent }, { frameId: 0 });
      } catch {
        // A closed or navigated source no longer needs its click intent.
      }
      return { completed: true };
    }
    try {
      const result = await chrome.tabs.sendMessage(entry.sourceTab, { type: 'preview:replay', intent: entry.intent }, { frameId: 0 });
      return { replayed: result?.replayed === true };
    } catch {
      return { replayed: false };
    }
  }
  return { allowed: false };
}
