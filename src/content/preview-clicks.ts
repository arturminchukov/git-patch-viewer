import { httpUrl, patchLink, PREVIEW_LIMIT, PREVIEW_TTL } from '../integration/preview-policy';

interface Intent {
  anchor: HTMLAnchorElement;
  snapshot: HTMLAnchorElement;
  expires: number;
}

export function createPreviewClicks(
  origins: () => string[],
  open: (url: string, intent: string) => Promise<{ opened?: boolean }>,
): { click(event: MouseEvent): void; replay(intent: string): boolean; discard(intent: string): void } {
  const pending = new Map<string, Intent>();
  let bypass = false;

  function replay(intent: string): boolean {
    const item = pending.get(intent);
    pending.delete(intent);
    if (!item || item.expires <= Date.now() || !item.anchor.isConnected) return false;
    const attributes = ['href', 'target', 'download', 'rel', 'referrerpolicy'];
    const previous = attributes.map((name) => item.anchor.getAttribute(name));
    bypass = true;
    try {
      attributes.forEach((name) => {
        const value = item.snapshot.getAttribute(name);
        if (value === null) item.anchor.removeAttribute(name);
        else item.anchor.setAttribute(name, value);
      });
      item.anchor.click();
      return true;
    } finally {
      bypass = false;
      attributes.forEach((name, i) => {
        if (previous[i] === null) item.anchor.removeAttribute(name);
        else item.anchor.setAttribute(name, previous[i]!);
      });
    }
  }

  function click(event: MouseEvent): void {
    if (bypass || !event.isTrusted || event.defaultPrevented || event.button !== 0 ||
        event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const anchor = event.composedPath().find((node): node is HTMLAnchorElement => node instanceof HTMLAnchorElement);
    if (!anchor || !patchLink(anchor.href) || !['', '_self', '_blank'].includes(anchor.target.toLowerCase())) return;
    const url = httpUrl(anchor.href)!;
    if (!origins().includes(url.origin)) return;
    // Retain only the small original intent, never the response body.
    for (const [key, value] of pending) if (value.expires <= Date.now()) pending.delete(key);
    if (pending.size >= PREVIEW_LIMIT) return;
    const intent = crypto.randomUUID();
    const snapshot = anchor.cloneNode(false) as HTMLAnchorElement;
    snapshot.href = anchor.href;
    pending.set(intent, { anchor, snapshot, expires: Date.now() + PREVIEW_TTL });
    event.preventDefault();
    void open(url.href, intent).then((result) => {
      if (!result?.opened) replay(intent);
    }).catch(() => replay(intent));
  }

  return { click, replay, discard: (intent) => { pending.delete(intent); } };
}
