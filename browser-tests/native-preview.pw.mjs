import { chromium, expect, test } from '@playwright/test';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { startPreviewFixture } from './native-preview-fixture.mjs';

// These tests install the built extension, not an injected/mocked content bundle.
// Grant fixture hosts at installation in this disposable copy so CI does not
// need to click browser-chrome permission dialogs. Production stays optional.
test('installed Chrome extension previews downloads and replays failures once', async ({ browserName }, info) => {
  test.skip(browserName !== 'chromium', 'Native Firefox is exercised by native-preview-firefox.py.');
  test.setTimeout(process.env.GPV_TEST_CAPACITY === '1' ? 240_000 : 120_000);
  const fixture = await startPreviewFixture();
  const temp = await mkdtemp(join(tmpdir(), 'gpv-native-preview-'));
  let context;
  try {
    const extension = join(temp, 'extension');
    await cp(resolve('dist-chrome'), extension, { recursive: true });
    const path = join(extension, 'manifest.json');
    const manifest = JSON.parse(await readFile(path, 'utf8'));
    manifest.host_permissions = ['http://127.0.0.1/*', 'https://www.postgresql.org/*'];
    await writeFile(path, JSON.stringify(manifest));
    context = await chromium.launchPersistentContext(join(temp, 'profile'), {
      headless: true,
      ...(process.env.GPV_CHROME_BINARY ? { executablePath: process.env.GPV_CHROME_BINARY } : { channel: 'chromium' }),
      args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
      viewport: { width: 1280, height: 800 },
      acceptDownloads: true,
    });
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const extensionOrigin = 'chrome-extension://' + new URL(worker.url()).host;
    const source = await context.newPage();
    await source.goto(fixture.url);
    // Off means ordinary browser download, even though fixture access is granted.
    const initialDownload = source.waitForEvent('download');
    await source.locator('#octet').click();
    expect((await initialDownload).suggestedFilename()).toBe('octet.patch');
    expect(context.pages().filter((page) => page.url().includes('/viewer.html'))).toHaveLength(0);

    // Open popup as a background tab so it initially resolves the actual source.
    await source.bringToFront();
    const popupPromise = context.waitForEvent('page');
    await worker.evaluate((origin) => chrome.tabs.create({ url: origin + '/popup.html', active: false }), extensionOrigin);
    const popup = await popupPromise;
    await expect(popup.locator('#preview-site')).toHaveText(fixture.url);
    await expect(popup.locator('#preview-toggle')).toHaveAttribute('data-on', 'false');
    await popup.locator('#preview-toggle').click();
    await expect(popup.locator('#preview-toggle')).toHaveAttribute('data-on', 'true');
    await expect.poll(() => worker.evaluate(async () => (await chrome.scripting.getRegisteredContentScripts()).some((script) => script.id === 'gpv-preview-links'))).toBe(true);
    const refresh = async () => {
      const ready = await worker.evaluate(async (url) => {
        const tabs = await chrome.tabs.query({});
        const tab = tabs.find((tab) => tab.url === url + '/');
        const result = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: async () => {
          if (!globalThis.__gpvPreviewLinks) return false;
          await globalThis.__gpvPreviewLinks();
          return true;
        } });
        return result[0]?.result;
      }, fixture.url);
      return ready;
    };
    await expect.poll(refresh).toBe(true);
    let unexpectedDownloads = 0;
    source.on('download', () => unexpectedDownloads++);
    for (const id of ['octet', 'attachment', 'download']) {
      const pagePromise = context.waitForEvent('page');
      await source.locator('#' + id).click();
      const viewer = await pagePromise;
      await expect(viewer).toHaveURL(/\/viewer\.html\?/);
      await expect(viewer.locator('.gpv-file')).toHaveCount(1);
      await expect(viewer.locator('.gpv-content')).toContainText('new value');
      await expect(viewer.locator('.gpv-content')).not.toContainText('2.43.0');
      expect(await viewer.evaluate(() => globalThis.untrustedPatchExecuted)).toBeUndefined();
      await expect(viewer.locator('.gpv-code img')).toHaveCount(0);
      await viewer.getByRole('button', { name: 'Switch to unified view', exact: true }).click();
      await expect(viewer.locator('.gpv-rows.unified')).toHaveCount(1);
      await viewer.getByRole('button', { name: 'Switch to split view', exact: true }).click();
      await viewer.screenshot({ path: info.outputPath(`native-chrome-${id}.png`) });
      await viewer.close();
    }
    expect(unexpectedDownloads).toBe(0);
    const giantPage = context.waitForEvent('page');
    await source.locator('#giant').click();
    const giant = await giantPage;
    await expect(giant.getByRole('button', { name: 'Render anyway' })).toHaveCount(3, { timeout: 45_000 });
    await expect(giant.locator('.gpv-code')).toHaveCount(0);
    await giant.getByRole('button', { name: 'Render anyway' }).first().click();
    await expect(giant.locator('.gpv-line-truncated')).toHaveCount(2);
    await giant.getByRole('button', { name: 'Switch to unified view', exact: true }).click();
    await expect(giant.locator('.gpv-line-truncated')).toHaveCount(2);
    await giant.close();

    if (process.env.GPV_TEST_CAPACITY === '1') {
      // Completed previews must release source-side fallback capacity, not
      // silently turn the 33rd click back into an ordinary download.
      for (let i = 0; i < 34; i++) {
        const opened = context.waitForEvent('page', { timeout: 10_000 });
        await source.locator('#octet').click();
        const viewer = await opened;
        await expect(viewer.locator('.gpv-file')).toHaveCount(1);
        await expect.poll(() => worker.evaluate(async () => ((await chrome.storage.session.get('gpv-preview-pending'))['gpv-preview-pending'] ?? []).length)).toBe(0);
        await viewer.close();
      }
    }
    const invalidDownload = source.waitForEvent('download');
    const failedPage = context.waitForEvent('page');
    await source.locator('#invalid').click();
    const failedViewer = await failedPage;
    expect((await invalidDownload).suggestedFilename()).toBe('invalid.patch');
    await expect.poll(() => failedViewer.isClosed()).toBe(true);
    expect(fixture.requests.filter((path) => path === '/invalid.patch')).toHaveLength(2);

    if (process.env.GPV_TEST_LIVE === '1') {
      await popup.evaluate(async () => {
        const key = 'gpv-preview-origins';
        const current = (await chrome.storage.local.get(key))[key];
        await chrome.storage.local.set({ [key]: [...current, 'https://www.postgresql.org'] });
      });
      await expect.poll(refresh).toBe(true);
      await source.evaluate(() => {
        const link = document.createElement('a');
        link.id = 'postgresql';
        link.href = 'https://www.postgresql.org/message-id/attachment/202759/v6-0001-Add-pg_xmin_horizon-view-showing-per-input-horizo.patch';
        link.textContent = 'Live PostgreSQL patch';
        document.body.append(link);
      });
      const pagePromise = context.waitForEvent('page');
      await source.locator('#postgresql').click();
      const viewer = await pagePromise;
      await expect(viewer.locator('.gpv-file')).toHaveCount(19, { timeout: 30_000 });
      await viewer.screenshot({ path: info.outputPath('native-chrome-postgresql.png') });
      await viewer.close();
    }
    await popup.locator('#preview-toggle').click();
    await expect(popup.locator('#preview-toggle')).toHaveAttribute('data-on', 'false');
    const disabledDownload = source.waitForEvent('download');
    await source.locator('#attachment').click();
    expect((await disabledDownload).suggestedFilename()).toBe('attachment.diff');
    console.log(JSON.stringify({ scenario: 'native-chrome', cases: ['disabled', 'octet-stream', 'attachment', 'download-attribute', 'failure-replay', 'disable-existing-tab'], livePostgreSQL: process.env.GPV_TEST_LIVE === '1' }));
  } finally {
    await context?.close();
    await fixture.close();
    await rm(temp, { recursive: true, force: true });
  }
});
