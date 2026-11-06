# Download preview interface

## Popup and storage

- `#preview-site`: exact current HTTP(S) origin, displayed with `textContent`.
- `#preview-status`: state or failure explanation.
- `#preview-toggle`: enable/disable button; `data-on="true"` when opted in and permitted.
- `storage.local['gpv-preview-origins']`: explicit array of exact HTTP(S) origins.
  Browser permission grants alone do **not** enable previews.
- `storage.session['gpv-preview-pending']`: at most 32 records with fields
  `request`, `intent`, `url`, `sourceOrigin`, `sourceTab`, `viewerTab`, `claimed`, `expires`.
  New records set `claimed: false`. An authorized claim persists `claimed: true`
  before returning permission to fetch; subsequent claims are denied. Claimed
  records remain available for owner completion or failure until consumed/expired.
  Expiry is five minutes. Expired entries cannot authorize a request and are
  pruned on subsequent transactions. Session storage survives worker suspension,
  not browser shutdown; no patch bodies are stored anywhere.

`storage.session.get/set` are available in Chrome 102 and Firefox 115, within
our Chrome 110 / Firefox 115 minimums. Compatibility reference:
[MDN browser compatibility data](https://github.com/mdn/browser-compat-data/blob/main/webextensions/api/storage.json).
Do not use the later Firefox `session.QUOTA_BYTES` / `getBytesInUse` APIs.

The build declares `http://*/*` and `https://*/*` under Chrome
`optional_host_permissions` or Firefox `optional_permissions`. These are only
**available for individual origin grants**, never requested as all-sites access.
Existing forge-button registration (`gpv-inject-button`) remains independent.
The separate `gpv-preview-links` registration loads `preview-links.js` on enabled,
permitted sources. Existing source tabs are injected too; installation is idempotent.
Match patterns cannot constrain ports; runtime opt-in validation does.

## RPC

All messages use `chrome.runtime.sendMessage`. Only extension-owned messages are
accepted (`sender.id === chrome.runtime.id`). Source operations require top-frame
HTTP(S) senders and explicit source-origin opt-in plus permission. No externally
connectable API, web-accessible viewer or arbitrary fetch proxy is provided.

| Type | Request fields | Result | Owner |
| --- | --- | --- | --- |
| `preview:config` | none | `{origins: string[]}` | Enabled source content script; otherwise empty list |
| `preview:open` | `url`, `intent` (opaque click UUID) | `{opened: boolean}` | Enabled top-frame source tab; destination also explicitly enabled/permitted |
| `preview:claim` | `request`, `url` | `{allowed: boolean}` | Exact viewer tab and extension viewer document, top frame; single use |
| `preview:complete` | `request` | `{completed: true}` | Same viewer owner; removes metadata after rendering and requests source intent discard |
| `preview:failed` | `request` | `{replayed: boolean}` | Same viewer owner; consumes metadata and requests one source replay |
| `preview:replay` | `intent` | `{replayed: boolean}` | Background → recorded source tab/frame 0 only |
| `preview:discard` | `intent` | none | Background → recorded source tab/frame 0 only; deletes the successful intent without replay |
| `preview:refresh` | none | none | Background → existing content script, refresh cached access |

Denied viewer messages return `{allowed: false}`. Denied open requests return
`{opened: false}`. RPC exceptions return false status flags. Callers cannot supply
fallback tab IDs. All pending transactions and registration changes are serialized
in the background. The background creates `about:blank`, saves the returned owner
tab ID, then navigates **that tab** to:

```
viewer.html?url=<URLSearchParams-encoded-target>&request=<opaque-background-UUID>
```

`url` is the stable viewer interface. The opaque request binds it to the actual
source click and viewer tab. A standalone URL or a request copied into another tab
cannot authorize a fetch. A viewer reload, including during an in-flight fetch,
deliberately offers ordinary URL actions instead of fetching without a new click.

## Fetch and fallback boundary

The viewer validates its claim and current destination opt-in/permission before
fetching in the extension context. It never asks a content script or worker to
fetch. Requests omit credentials/referrers and use `redirect: 'error'`, so even
same-origin redirects fall back rather than leaking to an unchecked destination.
Non-HTTP(S), userinfo-bearing URLs, non-OK HTTP responses, HTML, unsupported diffs,
network errors and the 60-second abort all reject. Parsing requires actual git
file models with paths and change content/metadata; a signature alone is not enough.
MIME and `Content-Disposition` do not select the parser.

Only the viewer document holds the response and parsed model, preserving the
existing large-file guards without 100 MB runtime/CDP copies or worker lifetime
dependence. Rendering uses `ui/mount.ts`, the exact same Shadow DOM tree as raw
patches: source link → toolbar → optional commit panel → sidebar/resizer/content.
Patch and source URL strings are inserted as text, not HTML.

The source keeps bounded five-minute click intents with the original anchor,
resolved URL and target/download/rel/referrer-policy attributes. Replay consumes
the intent once, restores those attributes temporarily, and bypasses interception.
Completion discards only its own source intent without navigation, freeing capacity
while outstanding intents retain their fallbacks. A closed/navigated source cannot
prevent successful viewer completion when discard delivery fails.
Browser gesture restrictions can still block a replayed `_blank` or download.
Only after replay confirmation does the viewer call its own `window.close()`;
there is no caller-directed tab removal. When the source is closed/navigated or an
intent expired or its original anchor was detached, replay returns false and the
viewer stays open with `#preview-original` and
`#preview-download` links.

## Verification scope

Unit/DOM tests cover MIME/attachments, download attributes, modifiers, missing
permissions, source/owner validation, expiry/capacity, failure replay, timeout,
redirect rejection, popup opt-in and shared mounting. Existing Playwright tests
exercise raw rendering and performance in Chromium and Firefox. Installed-extension
permission prompts, real tab ownership and browser download behavior require the
separate native integration harness; DOM mocks are not a substitute for it.
