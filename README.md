# Git Patch Viewer

<!-- Update the owner/repo slug if you push under a different name. -->
[![CI](https://github.com/arturminchukov/git-patch-viewer/actions/workflows/ci.yml/badge.svg)](https://github.com/arturminchukov/git-patch-viewer/actions/workflows/ci.yml)
[![Firefox users](https://img.shields.io/amo/users/git-patch-view?label=Firefox%20users)](https://addons.mozilla.org/firefox/addon/git-patch-view/)
[![Chrome users](https://img.shields.io/chrome-web-store/users/bbogdjfphogidkeapadommbflgdmpldp?label=Chrome%20users)](https://chromewebstore.google.com/detail/bbogdjfphogidkeapadommbflgdmpldp)

Browser extension (Chrome + Firefox, Manifest V3) that automatically renders
raw git patches / diffs as a beautiful diff view.

**Install:** [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/git-patch-view/) · [Chrome Web Store](https://chromewebstore.google.com/detail/bbogdjfphogidkeapadommbflgdmpldp)

Features:

- **Side-by-side** (split) or **unified** view — toggle in the toolbar,
  remembered across pages.
- Fixed file **sidebar** with a **flat / tree** layout toggle and a **search
  box** that filters files as you type.
- **Word-level** highlighting of the exact substrings that changed.
- Commit **subject + collapsible description** panel for `format-patch` input.
- **Light and dark** themes (follows the OS by default, toggle persisted).
- Optional **automatic "View patch" button** on GitHub / GitLab commit and
  PR/MR pages, plus GitHub compare pages (enable once from the toolbar popup —
  see below).
- Optional **downloadable patch previews**, enabled separately per site, for
  patch links served as attachments or `application/octet-stream`.

## How it works

When the browser opens any URL ending in `.patch` or `.diff` (GitHub
`commit/<sha>.patch`, `raw.githubusercontent.com/...diff`, etc.), a content
script checks that the page really is a diff and, if so, replaces the plain
text with the rendered UI inside an isolated Shadow DOM.

## "View patch" button on commit / PR / compare pages

Open the toolbar popup and press **Enable**: the browser asks once for access to
GitHub and GitLab, and from then on a floating **View patch** button appears
**automatically** on their commit and pull/merge request pages, and on GitHub
compare pages (`compare/<base>..<head>`), opening the `.patch` URL (rendered by
the content script). Disable it again anytime from the same popup.

Compare ranges are passed through as written, so `compare/a..b` and
`compare/a...b` each open the patch that page shows.

Access to those sites is **optional** — nothing is requested at install time,
and while disabled the popup still offers a manual "open patch" for the current
tab (using only `activeTab`). Bitbucket is not supported (its patch is served
from the REST API at a URL the renderer does not recognize), and neither are
GitLab compare pages (GitLab serves no patch for them).

## Downloadable patch previews

Open the toolbar popup on an HTTP(S) site and select **Enable previews on this
site**. Ordinary, unmodified primary clicks on `.patch` / `.diff` links then open
an extension-owned preview tab, leaving the source page open. This also handles
`Content-Disposition: attachment`, octet-stream responses and anchor `download`
attributes. The existing raw-document renderer is unchanged.

For cross-site links, enable **both** the source origin and the destination
origin by visiting each and using the popup. Other destinations remain native.
The explicit opt-in list is independent of the browser's existing patch-page or
forge-button permissions. Disabling previews does not revoke a shared host grant
used by the forge button. Browser host permissions cover all ports, but preview
opt-in is checked against the exact origin (scheme, host and port).

Only trusted primary clicks are intercepted; modifier clicks, middle/right clicks,
custom named targets and non-HTTP(S) links retain their normal behavior. No links
are crawled or fetched before a click. Both origins and host access are checked
again before fetching. The viewer accepts supported `diff --git` files, not HTML
login pages or unsupported plain unified diffs, regardless of response MIME.

Requests omit cookies and credentials and send no referrer. Redirects are rejected
instead of following them to an unchecked origin. Cookie-authenticated endpoints,
redirecting URLs and requests taking longer than 60 seconds fall back to the
original link. Original target/download attributes are replayed once in the source
tab, best effort: browser popup/download restrictions may still apply. If that
source is gone, the viewer keeps ordinary original-URL and download actions.
Requests are single-use; reloading a completed viewer offers the original URL
rather than silently fetching again.

The page retains only click intent. The extension viewer fetches and parses the
response in its own document and reuses the same sidebar, resizing, themes, view
modes and large-file rendering limits as raw patches. Patch bodies are never sent
through runtime messages, written to extension storage or handled by the worker.
See [the preview interface](docs/download-preview.md) for the security boundary
and integration-test contract.

## Architecture

Pure core (no DOM, no I/O) + a thin I/O boundary:

```
src/
  core/     parser.ts   raw text  -> PatchModel   (pure, tested)
            align.ts    hunk      -> split rows + word-level segments (pure, tested)
            types.ts    data model
  ui/       render.ts   PatchModel -> DOM nodes
            mount.ts    shared Shadow DOM viewer mounting, no startup side effects
            sidebar.ts  file list + click-to-scroll + scroll-spy
            file-order.ts  file order per layout (flat/tree) for content
            theme.ts    light/dark, persisted (storage injected)
            styles.ts   themed CSS (Shadow DOM scoped)
            dom.ts      tiny element helper
  content/  detect.ts   is-this-a-diff guard
            main.ts      raw document: read -> parse -> shared mount
            preview-links.ts  optional trusted-click interceptor (no fetching)
  viewer/   viewer.html / entry.ts  extension-owned downloadable patch viewer
            fetch-patch.ts         bounded credential-free fetch -> parser
  integration/  patch-url.ts     page URL -> raw-patch URL (pure, tested)
                hosts.ts         optional origins + injection match patterns
                inject-button.ts floating "View patch" button on host pages
                background.ts    (un)registers the injector as permission changes
                preview-*.ts     preview opt-in, registration and bound request RPC
  popup/    popup.html/.ts       toolbar popup: enable/disable the button
```

## Develop

```sh
yarn install
yarn build        # -> dist-chrome/ and dist-firefox/
yarn watch        # rebuild on change
yarn test         # vitest (parser, align, render)
yarn typecheck
yarn lint
```

## Install

Download the latest `git-patch-viewer-chrome-*.zip` /
`git-patch-viewer-firefox-*.zip` from the
[Releases](../../releases) page and unzip, or build locally (above). Then:

- **Chrome**: `chrome://extensions` → enable Developer mode → *Load unpacked* →
  select the unzipped `dist-chrome/` folder.
- **Firefox**: `about:debugging#/runtime/this-firefox` → *Load Temporary
  Add-on* → select `manifest.json` inside the unzipped Firefox build.

Then open any `.patch`/`.diff` URL.

## CI/CD

- **`.github/workflows/ci.yml`** — on every pull request and push to
  `main`/`master`: typecheck, lint, test, build, and upload the `dist-*`
  folders as a downloadable `extension-builds` artifact.
- **`.github/workflows/release.yml`** — on pushing a `v*` tag: runs tests,
  stamps the tag version into the manifest (`GPV_VERSION`), zips both builds,
  and publishes a GitHub Release with the zips attached.

Cut a release:

```sh
git tag v0.2.0
git push origin v0.2.0
```

## Publishing to the stores

Build ready-to-upload zips locally:

```sh
yarn package   # -> release/git-patch-viewer-{chrome,firefox}-<version>.zip
```

**Manual (simplest):** upload `release/…-chrome-*.zip` in the
[Chrome Web Store dashboard](https://chrome.google.com/webstore/devconsole)
(one-time $5 fee) and `release/…-firefox-*.zip` at
[addons.mozilla.org](https://addons.mozilla.org/developers/) (free).

**Automated on tag:** the release workflow also publishes to the stores when
these repository secrets are set (steps are skipped otherwise):

| Secret | Where to get it |
| --- | --- |
| `AMO_JWT_ISSUER`, `AMO_JWT_SECRET` | AMO → *Manage API Keys* (`web-ext sign`, channel `listed`) |
| `CWS_EXTENSION_ID` | the item's id in the Chrome Web Store dashboard |
| `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN` | Google Cloud OAuth client for the Chrome Web Store API |

The Firefox add-on id is `git-patch-viewer@arturminchukov` (see
`manifest/firefox.json`).

### Signed .xpi for self-distribution (Firefox)

Produce a Mozilla-signed `.xpi` (installable by clicking, without a public AMO
listing) via the `unlisted` channel:

```sh
export AMO_JWT_ISSUER="user:123456:78"   # AMO -> Manage API Keys
export AMO_JWT_SECRET="<secret>"
yarn sign:firefox                        # builds + signs -> web-ext-artifacts/*.xpi
```

Set `AMO_CHANNEL=listed` to submit to the public AMO listing instead. Each sign
needs a new `version` (bump it, or build with `GPV_VERSION`).

### Build instructions for AMO reviewers

This add-on's content script (`dist-firefox/content.js`) is **bundled from
TypeScript with esbuild**, so the source is submitted alongside the build.
Generate the source archive with:

```sh
yarn package:source   # -> release/git-patch-viewer-source-<version>.zip
```

Reproduce the exact build:

```
Build environment
- OS: Linux, macOS, or Windows
- Node.js: 24.x
- Yarn: 4.15 (provided via Corepack)

Steps
1. corepack enable
2. yarn install --immutable
3. yarn build

Result
- The add-on's content script is dist-firefox/content.js.
- It is produced by esbuild (version pinned in yarn.lock), which bundles the
  TypeScript sources under src/ into a single IIFE. No minification is applied,
  so the output stays readable.
- manifest/base.json + manifest/firefox.json are merged into
  dist-firefox/manifest.json by build.mjs.
- The PNG icons in icons/ are committed; they can be regenerated with
  `node scripts/gen-icons.mjs`.

Entry point: src/content/main.ts
```

Reproducibility comes from `yarn.lock` (it pins the exact esbuild version), so
keep it in the submitted source archive.

## Preview without installing

Open `demo/index.html` in a browser — it embeds `demo/sample.patch` and loads
the built `dist-chrome/content.js` directly. (Run `yarn build` first.)

## Icons

`scripts/gen-icons.mjs` generates `icons/icon-{16,32,48,128}.png` with no
external dependencies (`node scripts/gen-icons.mjs`). The build copies them
into each `dist-*/`.

## Notes / limitations

- Line pairing inside a change block is positional (v1); a similarity-based
  matcher can be added in `core/align.ts` without touching the rest.

## License

[MIT](LICENSE) © Artur Minchukou
