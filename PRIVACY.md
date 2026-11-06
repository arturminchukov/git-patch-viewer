# Privacy Policy — Git Patch Viewer

Git Patch Viewer does not collect, sell, or share browsing data or patch content
with its developer or third parties. It has no telemetry or application server.

## What the extension does

On raw `.patch` / `.diff` pages, the extension reads the page's own text and
renders it locally as a formatted diff. Optional forge integrations add a
“View patch” button to supported commit and pull/merge request pages.

Downloadable patch previews are separately opt-in per HTTP(S) site. On enabled
sites, an ordinary primary click on a `.patch` / `.diff` link opens an
extension-owned preview tab. Both source and destination origins must be
explicitly enabled and permitted. That viewer requests the URL from its original
server and parses the response locally. No links are crawled or prefetched.
Preview requests omit cookies/credentials and referrers and do not follow redirects.
The original link remains available for authenticated downloads and failures.

Patch content is never sent to the extension developer, routed through a proxy,
passed through runtime messages, or saved to extension storage.

## Data stored

Local extension storage (`chrome.storage.local`) on your device remembers:

- Interface preferences: theme, diff view mode, file-list layout and sidebar width.
- The exact origins where you explicitly enabled downloadable patch previews.

Session extension storage (`chrome.storage.session`, memory-only) holds at most
32 pending preview records: target URL, opaque request/click IDs, source origin,
source/viewer tab IDs and a five-minute expiration time. These let the extension
replay only the original clicked link if previewing fails, including after a
background worker suspension. Records are removed after completion/fallback;
expired records cannot authorize requests and are pruned on later transactions.
Session records disappear when the browser session ends. They never contain patch
bodies. Source pages retain only bounded, expiring click intents in memory.

None of this data is synchronized to an account or transmitted to a third party.

## Permissions

- **`storage`** — to remember preferences, explicit site opt-in and temporary
  fallback metadata described above.
- **Host access to `*://*/*.patch*` and `*://*/*.diff*`** — to render raw patch pages.
- **`activeTab`** — to identify the current site and offer manual forge patch links
  from the toolbar popup.
- **`scripting`** — to register the optional forge buttons and enabled-site patch
  link interceptor.
- **Optional HTTP(S) host access** — declared broadly so any individual site can
  be enabled, but requested only for a specific site when you enable previews.
  The forge button has its own optional host grants. No all-sites grant is
  requested by the preview feature. Turning previews off removes explicit opt-in
  without revoking grants shared with a forge button; browser settings can revoke
  host access entirely.

## Remote code

The extension contains no remote code. All logic is bundled inside the package.

## Contact

Questions or issues: https://github.com/arturminchukov/git-patch-viewer/issues
