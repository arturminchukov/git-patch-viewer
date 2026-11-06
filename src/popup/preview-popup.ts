import { enabledOrigins, httpUrl, originPattern, PREVIEW_ORIGINS_KEY } from '../integration/preview-policy';

export async function initPreviewPopup(): Promise<void> {
  const site = document.getElementById('preview-site')!;
  const status = document.getElementById('preview-status')!;
  const toggle = document.getElementById('preview-toggle') as HTMLButtonElement;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = httpUrl(tab?.url);
  if (!url) {
    status.textContent = 'Open an HTTP(S) site to enable downloadable patch previews.';
    toggle.hidden = true;
    return;
  }
  const origin = url.origin;
  site.textContent = origin;
  const refresh = async () => {
    const stored = await chrome.storage.local.get(PREVIEW_ORIGINS_KEY);
    const origins = enabledOrigins(stored[PREVIEW_ORIGINS_KEY]);
    const on = origins.includes(origin) && await chrome.permissions.contains({ origins: [originPattern(origin)] });
    toggle.dataset.on = String(on);
    toggle.textContent = on ? 'Disable previews on this site' : 'Enable previews on this site';
    status.textContent = on ? 'Ordinary .patch/.diff link clicks open a preview in a new tab.' : 'Downloadable patch previews are off on this site.';
  };
  toggle.addEventListener('click', () => {
    const enabling = toggle.dataset.on !== 'true';
    // Request synchronously in the user gesture; never request all sites.
    const permission = enabling ? chrome.permissions.request({ origins: [originPattern(origin)] }) : Promise.resolve(true);
    toggle.disabled = true;
    void permission.then(async (granted) => {
      if (!granted) return;
      const stored = await chrome.storage.local.get(PREVIEW_ORIGINS_KEY);
      const origins = enabledOrigins(stored[PREVIEW_ORIGINS_KEY]).filter((item) => item !== origin);
      if (enabling) origins.push(origin);
      // Do not remove a shared host grant: the existing forge button may use it.
      await chrome.storage.local.set({ [PREVIEW_ORIGINS_KEY]: origins });
      await refresh();
    }).catch(() => {
      status.textContent = 'Could not change site access. Please try again.';
    }).finally(() => { toggle.disabled = false; });
  });
  await refresh();
}
