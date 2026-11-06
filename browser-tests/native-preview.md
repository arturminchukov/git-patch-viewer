# Native downloadable patch preview checks

These tests install the compiled extension in a disposable browser profile. They
exercise native messaging, background ownership, extension-context fetch, real
HTTP download headers, file downloads, and source-tab fallback. They do not replace
browser APIs with mocks.

Build first:

```sh
yarn build
yarn exec playwright install --with-deps chromium firefox
yarn test:browser browser-tests/native-preview.pw.mjs --project chromium
```

Playwright uses its full Chromium build with extension support. To use another
Chrome for Testing binary, set `GPV_CHROME_BINARY` to its executable path. Do not
point tests at a personal browser profile.

For Firefox, install the official geckodriver 0.37.1, then run the dependency-free
stdlib WebDriver harness:

```sh
python3 browser-tests/native-preview-firefox.py \
  --firefox "$(node --input-type=module -e 'import { firefox } from "@playwright/test"; console.log(firefox.executablePath())')" \
  --geckodriver /path/to/geckodriver \
  --output ./test-results/native-firefox
```

Both harnesses cover:

- Disabled opt-in retains ordinary downloads despite available host permission.
- `application/octet-stream`, `text/plain` with `Content-Disposition: attachment`,
  and an anchor `download` attribute open the real diff UI without saving a file.
- Patch text is rendered as text, not executable markup; the version trailer is
  absent from the code.
- A 6 MB giant-line download stays collapsed, with bounded expansion using the
  shared renderer. Set `GPV_STRESS_GIANT_LINE_CHARS=17500000` for the optional
  105 MB version in either harness.
- Invalid content replays the original download once, closes only its preview,
  and preserves the source page.
- Disabling opt-in affects the already-open source page.

To include the live PostgreSQL attachment from issue #7, set `GPV_TEST_LIVE=1` for
the Chromium command, or add `--live` to the Firefox command. The live network
check is intentionally excluded from CI's deterministic fixture tests.

Set `GPV_TEST_CAPACITY=1` for the Chromium harness to additionally open and complete
34 consecutive previews from one source document. This checks that successful
previews release the bounded fallback-intent capacity.

## Permission and installation scope

Only the disposable test copy of the manifest grants loopback/PostgreSQL hosts
at installation. This avoids automating browser-chrome consent dialogs. The
production build still declares generic hosts as **optional**, and its explicit
per-site opt-in remains enforced. These checks establish real extension network
and tab behavior, not a successful user interaction with a permission dialog.

Chromium exercises the real popup opt-in/disable button. Firefox's WebDriver
selects a full-page extension tab rather than the toolbar popup, so that harness
seeds opt-in through actual extension storage and verifies native permission
checks/registration. Popup UI behavior also has separate DOM tests.

Firefox installation is temporary and unsigned, not store signing. Both profiles
and test downloads are removed on exit; screenshots and the Firefox driver log
remain in the selected test output directory. CI runs both native harnesses.
