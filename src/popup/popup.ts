// Popup: enable/disable the automatic in-page "View patch" button on
// GitHub/GitLab. Once enabled (a one-time permission grant), the button appears
// on commit and PR/MR pages by itself. While disabled, the popup still offers a
// manual "open patch" for the current tab (via activeTab, no standing access).

import { OPTIONAL_ORIGINS } from '../integration/hosts';
import { toPatchUrl } from '../integration/patch-url';

const status = document.getElementById('status') as HTMLParagraphElement;
const toggle = document.getElementById('toggle') as HTMLButtonElement;
const openBtn = document.getElementById('open') as HTMLButtonElement;

async function currentPatchUrl(): Promise<string | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.url ? toPatchUrl(tab.url) : null;
}

async function refresh(): Promise<void> {
  const enabled = await chrome.permissions.contains({ origins: OPTIONAL_ORIGINS });
  toggle.dataset.on = String(enabled);

  if (enabled) {
    status.textContent = 'The “View patch” button is on for GitHub and GitLab pages.';
    toggle.textContent = 'Disable';
    openBtn.hidden = true;
    return;
  }

  status.textContent =
    'Show a “View patch” button automatically on GitHub and GitLab commit and pull/merge request pages.';
  toggle.textContent = 'Enable';

  // While disabled, still let the user open the current page's patch manually.
  const patch = await currentPatchUrl();
  if (patch) {
    openBtn.hidden = false;
    openBtn.onclick = () => {
      void chrome.tabs.create({ url: patch });
      window.close();
    };
  } else {
    openBtn.hidden = true;
  }
}

toggle.addEventListener('click', () => {
  const enabling = toggle.dataset.on !== 'true';
  const action = enabling
    ? chrome.permissions.request({ origins: OPTIONAL_ORIGINS })
    : chrome.permissions.remove({ origins: OPTIONAL_ORIGINS });
  void action.then(refresh);
});

void refresh();
