import { describe, expect, it } from 'vitest';
import { toPatchUrl } from './patch-url';

describe('toPatchUrl — GitHub', () => {
  it('maps a commit page to its .patch', () => {
    expect(toPatchUrl('https://github.com/owner/repo/commit/a07be73315ab99e4e7f53f431b07d4caa728a302')).toBe(
      'https://github.com/owner/repo/commit/a07be73315ab99e4e7f53f431b07d4caa728a302.patch',
    );
  });

  it('maps a pull request (ignoring subpaths) to its .patch', () => {
    expect(toPatchUrl('https://github.com/owner/repo/pull/685/files')).toBe(
      'https://github.com/owner/repo/pull/685.patch',
    );
  });

  it('maps a two-dot compare range to its .patch', () => {
    expect(
      toPatchUrl(
        'https://github.com/jdx/mise-action/compare/e6a8b3978addb5a52f2b4cd9d91eafa7f0ab959d..dad1bfd3df957f44999b559dd69dc1671cb4e9ea',
      ),
    ).toBe(
      'https://github.com/jdx/mise-action/compare/e6a8b3978addb5a52f2b4cd9d91eafa7f0ab959d..dad1bfd3df957f44999b559dd69dc1671cb4e9ea.patch',
    );
  });

  it('maps a three-dot compare of refs (ignoring the query) to its .patch', () => {
    expect(toPatchUrl('https://github.com/owner/repo/compare/v1.0...main?expand=1')).toBe(
      'https://github.com/owner/repo/compare/v1.0...main.patch',
    );
  });

  it('maps a cross-fork compare (colons and slashes in refs)', () => {
    expect(toPatchUrl('https://github.com/owner/repo/compare/main...fork:release/1.0')).toBe(
      'https://github.com/owner/repo/compare/main...fork:release/1.0.patch',
    );
  });

  it('leaves an already-raw compare patch url unchanged', () => {
    expect(toPatchUrl('https://github.com/owner/repo/compare/a1b2c3d..e4f5a6b.patch')).toBe(
      'https://github.com/owner/repo/compare/a1b2c3d..e4f5a6b.patch',
    );
  });

  it('ignores a compare page with no range (the ref picker)', () => {
    expect(toPatchUrl('https://github.com/owner/repo/compare')).toBeNull();
    expect(toPatchUrl('https://github.com/owner/repo/compare/')).toBeNull();
    expect(toPatchUrl('https://github.com/owner/repo/compare/main')).toBeNull();
  });

  it('ignores unrelated github pages', () => {
    expect(toPatchUrl('https://github.com/owner/repo/issues/685')).toBeNull();
    expect(toPatchUrl('https://github.com/owner/repo')).toBeNull();
  });
});

describe('toPatchUrl — GitLab', () => {
  it('maps a commit page (nested groups) to its .patch', () => {
    expect(toPatchUrl('https://gitlab.com/group/sub/proj/-/commit/abcdef1234567')).toBe(
      'https://gitlab.com/group/sub/proj/-/commit/abcdef1234567.patch',
    );
  });

  it('maps a merge request to its .patch', () => {
    expect(toPatchUrl('https://gitlab.com/group/proj/-/merge_requests/42/diffs')).toBe(
      'https://gitlab.com/group/proj/-/merge_requests/42.patch',
    );
  });

  // GitLab serves no patch for compare pages: `.patch` is read as part of the ref
  // name and the HTML page comes back, so no button should be offered there.
  it('ignores compare pages (no patch route on GitLab)', () => {
    expect(toPatchUrl('https://gitlab.com/group/sub/proj/-/compare/v16.0.0...v16.1.0')).toBeNull();
    expect(toPatchUrl('https://gitlab.com/group/proj/-/compare?from=main&to=fix')).toBeNull();
  });
});

describe('toPatchUrl — other', () => {
  it('returns null for Bitbucket (unsupported)', () => {
    expect(toPatchUrl('https://bitbucket.org/ws/repo/commits/abc1234def5678')).toBeNull();
  });

  it('returns null for unknown hosts', () => {
    expect(toPatchUrl('https://example.com/owner/repo/commit/abcdef1')).toBeNull();
  });

  it('returns null for malformed input', () => {
    expect(toPatchUrl('not a url')).toBeNull();
  });
});
