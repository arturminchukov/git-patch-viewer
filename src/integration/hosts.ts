// Shared host configuration for the optional in-page "View patch" button.
// Used by the popup (which origins to request) and the background worker
// (which pages to inject into once permission is granted).

import giteaInstances from './gitea-instances.json';

/** Origins requested together when the user enables the integration. */
export const OPTIONAL_ORIGINS = ['*://github.com/*', '*://gitlab.com/*'];

/** Commit / PR / MR / compare pages where the "View patch" button is injected. */
export const BUTTON_MATCHES = [
  '*://github.com/*/*/commit/*',
  '*://github.com/*/*/pull/*',
  '*://github.com/*/*/compare/*',
  '*://gitlab.com/*/-/commit/*',
  '*://gitlab.com/*/-/merge_requests/*',
];

/**
 * Known public Gitea / Forgejo instances, each enabled on its own from the
 * popup and all off until then.
 *
 * Self-hosted instances cannot be offered: an origin is only grantable at
 * runtime if the manifest already declares it, so every supported host has to
 * ship with the build. build.mjs turns this same list into those manifest
 * entries, which is why it lives in JSON — the popup and the manifest cannot
 * disagree about which hosts exist.
 */
export const GITEA_HOSTS: readonly string[] = giteaInstances;

/** Origin requested when a Gitea / Forgejo instance is enabled. */
export function giteaOrigin(host: string): string {
  return `*://${host}/*`;
}

/** Commit / PR pages of one instance where the button is injected. */
export function giteaButtonMatches(host: string): string[] {
  return [`*://${host}/*/*/commit/*`, `*://${host}/*/*/pulls/*`];
}
