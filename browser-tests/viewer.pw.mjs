import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

function filePatch(name, lines = 80, width = 40) {
  return `diff --git a/${name} b/${name}\n--- a/${name}\n+++ b/${name}\n@@ -0,0 +1,${lines} @@\n`
    + Array.from({ length: lines }, (_, i) => `+${name} line ${i} ${'x'.repeat(width)}`).join('\n') + '\n';
}

async function openPatch(page, browserName, raw) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // Serve raw text over HTTP so stress fixtures do not exceed the browser's
  // DevTools message limit. Run the real content bundle at document_start.
  // Extension permissions/background registration are outside this layout test.
  const bundle = await readFile(resolve(process.env.GPV_BUNDLE_ROOT ?? '.', `dist-${browserName === 'firefox' ? 'firefox' : 'chrome'}/content.js`), 'utf8');
  await page.addInitScript((source) => {
    const inject = () => {
      const script = document.createElement('script');
      script.textContent = source;
      document.documentElement.append(script);
      script.remove();
    };
    if (document.documentElement) inject();
    else {
      const observer = new MutationObserver(() => {
        if (!document.documentElement) return;
        observer.disconnect();
        inject();
      });
      observer.observe(document, { childList: true });
    }
  }, bundle);
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(raw);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/example.patch`);
    await expect(page.locator('.gpv-file').first()).toBeVisible();
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  expect(errors).toEqual([]);
  return errors;
}

async function expectHeaderAligned(page, id) {
  const header = page.locator(`#${id} .gpv-file-header`);
  await expect.poll(() => header.evaluate((el) => el.getBoundingClientRect().top)).toBeGreaterThanOrEqual(0);
  await expect.poll(() => header.evaluate((el) => el.getBoundingClientRect().top)).toBeLessThanOrEqual(24);
  // Observe several rendering turns, not just the first estimated scroll offset.
  const positions = await header.evaluate((el) => new Promise((resolve) => {
    const tops = [];
    const sample = () => {
      tops.push(el.getBoundingClientRect().top);
      if (tops.length < 30) requestAnimationFrame(sample);
      else resolve(tops);
    };
    requestAnimationFrame(sample);
  }));
  expect(Math.min(...positions)).toBeGreaterThanOrEqual(0);
  expect(Math.max(...positions)).toBeLessThanOrEqual(24);
}

test('wheel scrolls the document, with navigation and both diff modes intact', async ({ page, browserName }) => {
  const raw = Array.from({ length: 12 }, (_, i) => filePatch(`src/file-${i}.ts`)).join('') + '-- \n2.43.0\n';
  const errors = await openPatch(page, browserName, raw);
  await expect.poll(() => page.evaluate(() => document.scrollingElement.scrollHeight)).toBeGreaterThan(800);
  await page.locator('.gpv-content').hover({ position: { x: 200, y: 200 } });
  await page.mouse.wheel(0, 700);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  expect(await page.locator('.gpv-content').evaluate((el) => el.scrollTop)).toBe(0);
  // Sidebar remains usable without scrolling back to the page header.
  await expect(page.getByRole('searchbox', { name: 'Filter files' })).toBeInViewport();
  const separator = page.getByRole('separator', { name: 'Resize sidebar' });
  const x = await separator.evaluate((el) => el.getBoundingClientRect().left + 2);
  const width = await page.locator('.gpv-sidebar').evaluate((el) => el.getBoundingClientRect().width);
  await page.mouse.move(x, 200);
  await page.mouse.down();
  await page.mouse.move(x + 80, 200, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => page.locator('.gpv-sidebar').evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThan(width + 50);
  await page.locator('.gpv-file-item').nth(8).click();
  await expectHeaderAligned(page, 'gpv-file-8');
  await expect(page.locator('.gpv-file-item').nth(8)).toHaveClass(/active/);
  // Manual page scrolling updates scroll-spy, not only sidebar clicks.
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.locator('.gpv-file-item').first()).toHaveClass(/active/);
  await page.getByRole('button', { name: 'Switch to unified view', exact: true }).click();
  await expect(page.locator('.gpv-rows.unified').first()).toBeVisible();
  await page.getByRole('button', { name: 'Switch to tree view', exact: true }).click();
  await expect(page.locator('.gpv-tree-dir')).toHaveCount(1);
  await page.locator('.gpv-file-item[data-target="gpv-file-10"]').click();
  await expectHeaderAligned(page, 'gpv-file-10');
  await expect(page.locator('.gpv-content')).not.toContainText('2.43.0');
  await expect(page.locator('.gpv-content')).not.toContainText('.43.0');
  await page.screenshot({ path: test.info().outputPath('viewer.png') });
  expect(errors).toEqual([]);
});

test('offscreen files and hunks stay virtualized while a large patch scrolls', async ({ page, browserName }) => {
  test.setTimeout(90_000);
  const raw = Array.from({ length: 120 }, (_, i) => filePatch(`src/file-${i}.ts`, 80, 100)).join('');
  const start = Date.now();
  const errors = await openPatch(page, browserName, raw);
  const mountMs = Date.now() - start;
  await expect(page.locator('.gpv-file')).toHaveCount(120);
  const last = page.locator('#gpv-file-119');
  const lastCode = last.locator('.gpv-code').first();
  expect(await last.evaluate((el) => getComputedStyle(el).contentVisibility)).toBe('auto');
  expect(await last.locator('.gpv-hunk').evaluate((el) => getComputedStyle(el).contentVisibility)).toBe('auto');
  // Unlike a CSS-only assertion, this checks that the browser is skipping
  // an offscreen subtree and reveals it again when it enters the viewport.
  await expect.poll(() => lastCode.evaluate((el) => el.checkVisibility({ contentVisibilityAuto: true }))).toBe(false);
  const frames = await page.evaluate(() => new Promise((resolve) => {
    const gaps = [];
    let previous = performance.now();
    const step = (now) => {
      gaps.push(now - previous);
      previous = now;
      window.scrollBy(0, 300);
      if (gaps.length < 30) requestAnimationFrame(step);
      else resolve({ maxGapMs: Math.max(...gaps), frames: gaps.length, scrollY: window.scrollY });
    };
    requestAnimationFrame(step);
  }));
  expect(frames.scrollY).toBeGreaterThan(0);
  // Generous smoke-test budgets catch tab freezes, not hardware-specific FPS.
  expect(frames.maxGapMs).toBeLessThan(1500);
  expect(mountMs).toBeLessThan(30_000);
  const search = page.getByRole('searchbox', { name: 'Filter files' });
  await search.fill('file-119.ts');
  await page.locator('.gpv-file-item:not(.gpv-hidden)').click();
  await expect(last).toBeInViewport();
  await expect.poll(() => lastCode.evaluate((el) => el.checkVisibility({ contentVisibilityAuto: true }))).toBe(true);
  console.log(JSON.stringify({ browserName, scenario: 'many-files', patchMB: raw.length / 1e6, mountMs, ...frames }));
  expect(errors).toEqual([]);
});

test('giant lines stay collapsed, expand boundedly and survive a view switch', async ({ page, browserName }) => {
  test.setTimeout(90_000);
  const size = Number(process.env.GPV_STRESS_GIANT_LINE_CHARS ?? 1_000_000);
  const raw = Array.from({ length: 3 }, (_, i) =>
    `diff --git a/dist/${i}.js b/dist/${i}.js\n@@ -1 +1 @@\n-${'a'.repeat(size)}\n+${'b'.repeat(size)}\n`,
  ).join('') + '-- \n2.43.0\n';
  const start = Date.now();
  const errors = await openPatch(page, browserName, raw);
  const mountMs = Date.now() - start;
  await expect(page.getByRole('button', { name: 'Render anyway' })).toHaveCount(3);
  await expect(page.locator('.gpv-code')).toHaveCount(0);
  const expandStart = Date.now();
  await page.getByRole('button', { name: 'Render anyway' }).first().click();
  await expect(page.locator('.gpv-line-truncated')).toHaveCount(2);
  const expandMs = Date.now() - expandStart;
  await page.getByRole('button', { name: 'Switch to unified view', exact: true }).click();
  await expect(page.locator('.gpv-line-truncated')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Render anyway' })).toHaveCount(2);
  expect(await page.locator('.gpv-content').evaluate((el) => el.textContent.length)).toBeLessThan(15_000);
  const metrics = { browserName, scenario: 'giant-lines', patchMB: raw.length / 1e6, mountMs, expandMs };
  console.log(JSON.stringify(metrics));
  // The optional 105 MB run includes the browser's raw-text loading time.
  expect(mountMs).toBeLessThan(size > 1_000_000 ? 60_000 : 30_000);
  expect(expandMs).toBeLessThan(5000);
  expect(errors).toEqual([]);
});
