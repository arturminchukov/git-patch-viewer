// Sign the Firefox build with Mozilla (web-ext sign). Defaults to the
// `unlisted` channel, which returns a signed .xpi in web-ext-artifacts/ for
// self-distribution. Credentials come from the environment so they are never
// committed. Get them at https://addons.mozilla.org/developers/addon/api/key/
//
// Usage:
//   export AMO_JWT_ISSUER="user:123456:78"
//   export AMO_JWT_SECRET="<secret>"
//   yarn sign:firefox            # unlisted (signed .xpi)
//   AMO_CHANNEL=listed yarn sign:firefox   # submit to the public AMO listing

import { execFileSync } from 'node:child_process';

const issuer = process.env.AMO_JWT_ISSUER;
const secret = process.env.AMO_JWT_SECRET;
const channel = process.env.AMO_CHANNEL || 'unlisted';

if (!issuer || !secret) {
  console.error(
    [
      'Missing AMO credentials.',
      'Set AMO_JWT_ISSUER and AMO_JWT_SECRET first',
      '(get them at https://addons.mozilla.org/developers/addon/api/key/):',
      '',
      '  export AMO_JWT_ISSUER="user:123456:78"',
      '  export AMO_JWT_SECRET="<secret>"',
      '  yarn sign:firefox',
    ].join('\n'),
  );
  process.exit(1);
}

execFileSync(
  'npx',
  [
    '--yes',
    'web-ext@latest',
    'sign',
    '--source-dir',
    'dist-firefox',
    '--channel',
    channel,
    '--api-key',
    issuer,
    '--api-secret',
    secret,
  ],
  { stdio: 'inherit' },
);
