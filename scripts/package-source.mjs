// Build a clean source archive for AMO reviewers: everything needed to
// reproduce the build (src, build.mjs, manifest, scripts, icons, configs,
// package.json, yarn.lock, .yarnrc.yml) — but no node_modules, no builds.

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const base = JSON.parse(readFileSync(join(root, 'manifest/base.json'), 'utf8'));
const version = process.env.GPV_VERSION || base.version;

const releaseDir = join(root, 'release');
mkdirSync(releaseDir, { recursive: true });

const zipPath = join('release', `git-patch-viewer-source-${version}.zip`);
rmSync(join(root, zipPath), { force: true });

const excludes = [
  'node_modules/*',
  'dist-chrome/*',
  'dist-firefox/*',
  'dist-tsc/*',
  'release/*',
  '.yarn/*',
  '.git/*',
  '*.zip',
  '**/.DS_Store',
];

execFileSync('zip', ['-r', '-q', zipPath, '.', '-x', ...excludes], {
  cwd: root,
  stdio: 'inherit',
});
console.log(`packaged ${zipPath}`);
