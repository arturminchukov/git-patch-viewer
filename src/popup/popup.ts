// Popup: enable/disable the automatic in-page "View patch" button on
// GitHub/GitLab. Once enabled (a one-time permission grant), the button appears
// on commit, PR/MR and GitHub compare pages by itself. While disabled, the popup
// still offers a manual "open patch" for the current tab (via activeTab, no
// standing access).
//
// Gitea/Forgejo instances are listed separately and granted one at a time, so
// enabling one does not hand out access to the rest.

import { GITEA_HOSTS, OPTIONAL_ORIGINS, giteaOrigin } from '../integration/hosts';
import { toPatchUrl } from '../integration/patch-url';

const status = document.getElementById('status') as HTMLParagraphElement;
const toggle = document.getElementById('toggle') as HTMLButtonElement;
const openBtn = document.getElementById('open') as HTMLButtonElement;
const giteaList = document.getElementById('gitea') as HTMLUListElement;

async function currentPatchUrl(): Promise<string | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.url ? toPatchUrl(tab.url) : null;
}

// One row per shipped instance (see hosts.ts). The list is fixed, so the rows
// are built once and only their state is refreshed.
const giteaRows = GITEA_HOSTS.map((host) => {
  const li = document.createElement('li');
  const name = document.createElement('span');
  name.textContent = host;

  const button = document.createElement('button');
  button.type = 'button';
  button.addEventListener('click', () => {
    // Called straight from the click: permissions.request() needs the gesture.
    const origins = [giteaOrigin(host)];
    const action =
      button.dataset.on === 'true'
        ? chrome.permissions.remove({ origins })
        : chrome.permissions.request({ origins });
    void action.then(refresh);
  });

  li.append(name, button);
  giteaList.append(li);
  return { host, li, button };
});

async function refreshGitea(): Promise<void> {
  const granted = await Promise.all(
    giteaRows.map((row) => chrome.permissions.contains({ origins: [giteaOrigin(row.host)] })),
  );
  giteaRows.forEach((row, i) => {
    const on = String(granted[i]);
    row.li.dataset.on = on;
    row.button.dataset.on = on;
    row.button.textContent = granted[i] ? 'Disable' : 'Enable';
  });
}

async function refreshCore(): Promise<void> {
  const enabled = await chrome.permissions.contains({ origins: OPTIONAL_ORIGINS });
  toggle.dataset.on = String(enabled);

  if (enabled) {
    status.textContent = 'The “View patch” button is on for GitHub and GitLab pages.';
    toggle.textContent = 'Disable';
    openBtn.hidden = true;
    return;
  }

  status.textContent =
    'Show a “View patch” button automatically on GitHub and GitLab commit and pull/merge request pages, and on GitHub compare pages.';
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

async function refresh(): Promise<void> {
  await Promise.all([refreshCore(), refreshGitea()]);
}

toggle.addEventListener('click', () => {
  const enabling = toggle.dataset.on !== 'true';
  const action = enabling
    ? chrome.permissions.request({ origins: OPTIONAL_ORIGINS })
    : chrome.permissions.remove({ origins: OPTIONAL_ORIGINS });
  void action.then(refresh);
});

void refresh();
