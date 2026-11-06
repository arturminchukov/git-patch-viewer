// Explicit opt-in is separate from permissions.contains: static patch matches
// can otherwise make that API report a host as already granted.
export const PREVIEW_ORIGINS_KEY = 'gpv-preview-origins';
export const PREVIEW_PENDING_KEY = 'gpv-preview-pending';
export const PREVIEW_TTL = 5 * 60 * 1000;
export const PREVIEW_LIMIT = 32;

export function httpUrl(value: unknown): URL | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}

export function patchLink(value: unknown): boolean {
  const url = httpUrl(value);
  return !!url && /\.(patch|diff)$/i.test(url.pathname);
}

// Match patterns cannot restrict ports; the opt-in list still uses exact origins.
export function originPattern(origin: string): string {
  const url = new URL(origin);
  return `${url.protocol}//${url.hostname}/*`;
}

export function enabledOrigins(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((entry): entry is string => {
    const url = httpUrl(entry);
    return !!url && url.origin === entry;
  }))];
}

export async function permittedOrigins(): Promise<string[]> {
  const stored = await chrome.storage.local.get(PREVIEW_ORIGINS_KEY);
  const origins = enabledOrigins(stored[PREVIEW_ORIGINS_KEY]);
  const granted = await Promise.all(origins.map((origin) =>
    chrome.permissions.contains({ origins: [originPattern(origin)] }),
  ));
  return origins.filter((_, i) => granted[i]);
}
