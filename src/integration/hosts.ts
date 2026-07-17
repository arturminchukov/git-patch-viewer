// Shared host configuration for the optional in-page "View patch" button.
// Used by the popup (which origins to request) and the background worker
// (which pages to inject into once permission is granted).

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
