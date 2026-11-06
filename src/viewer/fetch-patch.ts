import { httpUrl } from '../integration/preview-policy';
import { parse } from '../core/parser';
import type { PatchModel } from '../core/types';

/** Runs only in the extension viewer, never through a background fetch proxy. */
export async function fetchPatch(url: string, fetcher: typeof fetch = fetch): Promise<PatchModel> {
  if (!httpUrl(url)) throw new Error('Unsupported URL');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetcher(url, {
      signal: controller.signal,
      credentials: 'omit',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    // Redirects are deliberately unsupported: no request may escape the
    // checked destination origin, including through an authenticated redirect.
    if (response.redirected || (response.url && response.url !== new URL(url).href.replace(/#.*$/, ''))) {
      throw new Error('Redirected patch URLs are not supported');
    }
    const raw = await response.text();
    if (/^\s*</.test(raw)) throw new Error('HTML is not a patch');
    const model = parse(raw);
    const hasChanges = model.files.some((file) => file.hunks.length || file.isBinary || file.status !== 'modified') ||
      /^old mode \d+\r?\nnew mode \d+$/m.test(raw);
    if (!hasChanges || !model.files.length || model.files.some((file) => !file.oldPath && !file.newPath)) {
      throw new Error('No supported git diff files found');
    }
    return model;
  } finally {
    clearTimeout(timer);
  }
}
