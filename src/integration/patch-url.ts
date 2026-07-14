// Map a GitHub / GitLab commit or PR/MR page URL to the URL that serves its raw
// patch (which content.js renders). Pure and unit-tested.
//
// - GitHub: /owner/repo/commit/<sha>        -> +.patch
//           /owner/repo/pull/<n>            -> +.patch
// - GitLab: /group/.../-/commit/<sha>       -> +.patch
//           /group/.../-/merge_requests/<n> -> +.patch
//
// Bitbucket is intentionally unsupported: its patch is served from the REST API
// at a URL without a `.patch` suffix, which content.js would not recognize.

const SHA = '[0-9a-f]{7,40}';

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
      return null;
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
