// Injected into GitHub/GitLab commit and PR/MR pages (only after the user
// enables the integration). Adds a floating "View patch" button that navigates
// to the raw-patch URL, which the extension then renders.
//
// A floating button is used deliberately: each host's inline toolbar markup
// changes often, so anchoring to it would break; a self-contained overlay is
// robust across redesigns.

import { toPatchUrl } from './patch-url';

const HOST_ID = 'gpv-view-patch';

function styleEl(): HTMLStyleElement {
  const style = document.createElement('style');
  style.textContent = `
    .btn {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 2147483647;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 9px 14px;
      font: 600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      color: #fff;
      background: #1f6feb;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
      text-decoration: none;
      cursor: pointer;
    }
    .btn:hover { background: #388bfd; }
  `;
  return style;
}

function anchorEl(target: string): HTMLAnchorElement {
  const a = document.createElement('a');
  a.className = 'btn';
  a.href = target;
  a.textContent = 'View patch';
  a.title = 'Open this patch with Git Patch Viewer';
  return a;
}

function render(): void {
  const target = toPatchUrl(location.href);
  const existing = document.getElementById(HOST_ID);

  if (!target) {
    existing?.remove();
    return;
  }
  if (existing) {
    const link = existing.shadowRoot?.querySelector('a');
    if (link) link.href = target;
    return;
  }

  const host = document.createElement('div');
  host.id = HOST_ID;
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.append(styleEl(), anchorEl(target));
  document.body.append(host);
}

// SPA navigations (GitHub/GitLab) change the URL without a reload; poll the URL
// so the button stays correct. Polling is host-agnostic and cheap.
let lastHref = '';
function tick(): void {
  if (location.href !== lastHref) {
    lastHref = location.href;
    render();
  }
}

tick();
setInterval(tick, 800);
