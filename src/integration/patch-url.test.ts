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
