import { describe, expect, it } from 'vitest';
import { httpUrl, patchLink, enabledOrigins, originPattern } from './preview-policy';

describe('download preview policy', () => {
  it('accepts ordinary HTTP(S) patch links regardless of download delivery', () => {
    expect(patchLink('https://example.org/a.patch?download=1')).toBe(true);
    expect(patchLink('http://example.org/a.diff#part')).toBe(true);
    expect(originPattern('https://example.org:8443')).toBe('https://example.org/*');
  });
  it('rejects other URLs and credential-bearing requests', () => {
    for (const url of ['javascript:alert(1)', 'file:///a.patch', 'https://u:p@example.org/a.patch', 'https://example.org/a.patch.exe']) {
      expect(patchLink(url)).toBe(false);
    }
    expect(httpUrl('https://u@example.org')).toBeNull();
  });
  it('keeps an explicit, validated opt-in list independent of manifest grants', () => {
    expect(enabledOrigins(['https://example.org', 'file://bad', 'https://example.org/path', 'https://example.org', 1])).toEqual(['https://example.org']);
    expect(enabledOrigins(undefined)).toEqual([]);
  });
});
