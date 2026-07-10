// Zip the already-built dist-chrome/ and dist-firefox/ into release/ with
// versioned names, ready for manual upload to the Chrome Web Store and AMO.
// Run after `node build.mjs` (see the `package` npm script).

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const base = JSON.parse(readFileSync(join(root, 'manifest/base.json'), 'utf8'));
const version = process.env.GPV_VERSION || base.version;

const releaseDir = join(root, 'release');
mkdirSync(releaseDir, { recursive: true });

for (const target of ['chrome', 'firefox']) {
  const srcDir = join(root, `dist-${target}`);
  const zipPath = join(releaseDir, `git-patch-viewer-${target}-${version}.zip`);
  rmSync(zipPath, { force: true });
  // Zip the folder contents (manifest.json at the archive root).
  execFileSync('zip', ['-qr', zipPath, '.'], { cwd: srcDir, stdio: 'inherit' });
  console.log(`packaged release/git-patch-viewer-${target}-${version}.zip`);
}
