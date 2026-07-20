// Map a GitHub / GitLab / Gitea commit, PR/MR or compare page URL to the URL that
// serves its raw patch (which content.js renders). Pure and unit-tested.
//
// - GitHub: /owner/repo/commit/<sha>        -> +.patch
//           /owner/repo/pull/<n>            -> +.patch
//           /owner/repo/compare/<range>     -> +.patch
// - GitLab: /group/.../-/commit/<sha>       -> +.patch
//           /group/.../-/merge_requests/<n> -> +.patch
// - Gitea:  /owner/repo/commit/<sha>        -> +.patch
//           /owner/repo/pulls/<n>           -> +.patch
//
// GitLab compare pages are intentionally unsupported: unlike GitHub, GitLab
// serves no patch for them — `/-/compare/a...b.patch` reads `.patch` as part of
// the ref name and returns the HTML page.
//
// Bitbucket is intentionally unsupported: its patch is served from the REST API
// at a URL without a `.patch` suffix, which content.js would not recognize.

import { GITEA_HOSTS } from './hosts';

const SHA = '[0-9a-f]{7,40}';
// Gitea/Forgejo repositories may use sha256 object format, so commit ids there
// run to 64 hex characters.
const GITEA_SHA = '[0-9a-f]{7,64}';

/** Return the raw-patch URL for a code-host page URL, or null if unsupported. */
export function toPatchUrl(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  switch (url.hostname) {
    case 'github.com':
      return gitHub(url);
    case 'gitlab.com':
      return gitLab(url);
    default:
      // Nothing in a Gitea/Forgejo URL identifies the software, so an instance is
      // recognized only by being on the shipped list (see hosts.ts).
      return GITEA_HOSTS.includes(url.hostname) ? gitea(url) : null;
  }
}

function gitHub(url: URL): string | null {
  const commit = url.pathname.match(new RegExp(`^/([^/]+)/([^/]+)/commit/(${SHA})`));
  if (commit) {
    const [, owner, repo, sha] = commit;
    return `${url.origin}/${owner}/${repo}/commit/${sha}.patch`;
  }
  const pull = url.pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (pull) {
    const [, owner, repo, n] = pull;
    return `${url.origin}/${owner}/${repo}/pull/${n}.patch`;
  }
  const compare = url.pathname.match(/^\/([^/]+)\/([^/]+)\/compare\/(.+)/);
  if (compare) {
    const [, owner, repo, rest] = compare;
    // A range is free-form (`a..b`, `a...b`, `owner:branch...fork:branch`) and may
    // contain slashes, so it is taken verbatim rather than pattern-matched. Either
    // dot form serves a patch and the two mean different things, so the range is
    // never rewritten. A range-less compare page (the ref picker) has no patch.
    const range = rest.replace(/\/+$/, '').replace(/\.(?:patch|diff)$/, '');
    if (range.includes('..')) return `${url.origin}/${owner}/${repo}/compare/${range}.patch`;
  }
  return null;
}

function gitLab(url: URL): string | null {
  const commit = url.pathname.match(new RegExp(`^(/.+?)/-/commit/(${SHA})`));
  if (commit) {
    const [, project, sha] = commit;
    return `${url.origin}${project}/-/commit/${sha}.patch`;
  }
  const mr = url.pathname.match(/^(\/.+?)\/-\/merge_requests\/(\d+)/);
  if (mr) {
    const [, project, n] = mr;
    return `${url.origin}${project}/-/merge_requests/${n}.patch`;
  }
  return null;
}

// Gitea/Forgejo keep the repository at the path root like GitHub, but name the
// pull request route `pulls` (plural). Both routes serve the patch from the same
// path plus `.patch`. Anything nested deeper (`/repo/wiki/commit/...`) is a
// different route and has no patch, so the owner/repo segments stay `[^/]+`.
function gitea(url: URL): string | null {
  // The trailing lookahead keeps a longer hex run from being truncated to a
  // valid-looking 64-char id: such a segment is not a commit and has no patch.
  const commit = url.pathname.match(
    new RegExp(`^/([^/]+)/([^/]+)/commit/(${GITEA_SHA})(?![0-9a-f])`),
  );
  if (commit) {
    const [, owner, repo, sha] = commit;
    return `${url.origin}/${owner}/${repo}/commit/${sha}.patch`;
  }
  const pull = url.pathname.match(/^\/([^/]+)\/([^/]+)\/pulls\/(\d+)/);
  if (pull) {
    const [, owner, repo, n] = pull;
    return `${url.origin}/${owner}/${repo}/pulls/${n}.patch`;
  }
  return null;
}
