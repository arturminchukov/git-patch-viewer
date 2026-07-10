// Build the extension for Chrome and Firefox into dist-chrome/ and
// dist-firefox/. Bundles the content script with esbuild and merges the
// per-browser manifest with the shared base.

import { build, context } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes('--watch');

const TARGETS = [
  { name: 'chrome', dir: 'dist-chrome', overlay: 'manifest/chrome.json' },
  { name: 'firefox', dir: 'dist-firefox', overlay: 'manifest/firefox.json' },
];

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function writeManifest(target) {
  const base = JSON.parse(await readFile(join(root, 'manifest/base.json'), 'utf8'));
  const overlay = JSON.parse(await readFile(join(root, target.overlay), 'utf8'));
  const merged = { ...base, ...overlay };
  // Releases stamp the tag version (e.g. GPV_VERSION=0.2.0) into the manifest.
  if (process.env.GPV_VERSION) merged.version = process.env.GPV_VERSION;
  await writeFile(
    join(root, target.dir, 'manifest.json'),
    JSON.stringify(merged, null, 2) + '\n',
  );
}

async function copyIcons(target) {
  const iconsDir = join(root, 'icons');
  if (await exists(iconsDir)) {
    await cp(iconsDir, join(root, target.dir, 'icons'), { recursive: true });
  }
}

async function buildTarget(target) {
  const outDir = join(root, target.dir);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const options = {
    entryPoints: [join(root, 'src/content/main.ts')],
    bundle: true,
    format: 'iife',
    target: target.name === 'firefox' ? 'firefox115' : 'chrome110',
    outfile: join(outDir, 'content.js'),
    sourcemap: watch,
    logLevel: 'info',
  };

  if (watch) {
    const ctx = await context(options);
    await ctx.watch();
  } else {
    await build(options);
  }

  await writeManifest(target);
  await copyIcons(target);
}

for (const target of TARGETS) {
  await buildTarget(target);
}

if (watch) {
  console.log('Watching for changes… (Ctrl+C to stop)');
}
