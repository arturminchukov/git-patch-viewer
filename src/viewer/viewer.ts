import { httpUrl, permittedOrigins } from '../integration/preview-policy';
import { el } from '../ui/dom';
import { mountPatch } from '../ui/mount';
import { fetchPatch } from './fetch-patch';

function originalLink(url: string, download = false): HTMLAnchorElement {
  return el('a', {
    id: download ? 'preview-download' : 'preview-original',
    href: url,
    text: download ? 'Download original' : url,
    target: '_blank',
    rel: 'noopener noreferrer',
    ...(download ? { download: '' } : {}),
  }) as HTMLAnchorElement;
}

export async function runViewer(locationUrl: string = location.href): Promise<void> {
  const params = new URL(locationUrl).searchParams;
  const url = httpUrl(params.get('url'));
  const request = params.get('request');
  document.body.replaceChildren(el('p', { text: 'Loading patch…' }));
  try {
    if (!url || !request) throw new Error('Open a patch link from an enabled site to preview it.');
    const result = await chrome.runtime.sendMessage({ type: 'preview:claim', request, url: url.href });
    const origins = await permittedOrigins();
    if (!result?.allowed || !origins.includes(url.origin)) throw new Error('Preview access is not enabled for this request.');
    const model = await fetchPatch(url.href);
    await mountPatch(model);
    const shadow = document.getElementById('git-patch-viewer-host')!.shadowRoot!;
    const source = el('div', { class: 'gpv-commit' }, [originalLink(url.href)]);
    shadow.querySelector('.gpv-root')!.prepend(source);
    // The model stays in this document. Only the request ID crosses messaging.
    try {
      await chrome.runtime.sendMessage({ type: 'preview:complete', request });
    } catch {
      // Cleanup is best effort; do not replay a link after rendering succeeded.
    }
  } catch (err) {
    document.body.replaceChildren(
      el('h1', { text: 'Patch preview unavailable' }),
      el('p', { text: err instanceof Error ? err.message : 'Could not load this patch.' }),
    );
    if (url) document.body.append(originalLink(url.href), el('p', {}, [originalLink(url.href, true)]));
    document.body.append(el('p', { text: 'Preview requires both sites to be enabled. Redirects and cookie-authenticated downloads are not supported; use the original link instead.' }));
    if (request) {
      try {
        const result = await chrome.runtime.sendMessage({ type: 'preview:failed', request });
        if (result?.replayed) window.close();
      } catch {
        // Keep the ordinary URL actions when the source or worker is gone.
      }
    }
  }
}
