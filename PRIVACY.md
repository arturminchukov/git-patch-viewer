# Privacy Policy — Git Patch Viewer

_Last updated: 2026-07-10_

Git Patch Viewer does not collect, store on any server, transmit, sell, or
share any personal or user data.

## What the extension does

The extension runs only on pages whose URL ends in `.patch` or `.diff`. On those
pages it reads the page's own text and re-renders it locally as a formatted
diff. All processing happens in your browser — no page content is ever sent to
any server or third party.

## Data stored

The only data the extension stores is your own interface preferences: the
selected theme (light/dark), the diff view mode (side-by-side or unified), and
the file-list layout (flat or tree). These are saved with the browser's local
extension storage (`chrome.storage.local`) on your device and are never
transmitted anywhere.

## Permissions

- **`storage`** — to remember the interface preferences listed above.
- **Host access to `*://*/*.patch*` and `*://*/*.diff*`** — to read and render
  patch and diff pages. The extension does nothing on any other page.

## Remote code

The extension contains no remote code. All logic is bundled inside the package.

## Contact

Questions or issues: https://github.com/arturminchukov/git-patch-viewer/issues
