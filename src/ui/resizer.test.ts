import { describe, expect, it } from 'vitest';
import { clampWidth } from './resizer';

describe('clampWidth', () => {
  it('returns the value when within bounds', () => {
    expect(clampWidth(280, 180, 640)).toBe(280);
  });

  it('clamps to the minimum', () => {
    expect(clampWidth(120, 180, 640)).toBe(180);
  });

  it('clamps to the maximum', () => {
    expect(clampWidth(900, 180, 640)).toBe(640);
  });

  it('keeps the bounds themselves', () => {
    expect(clampWidth(180, 180, 640)).toBe(180);
    expect(clampWidth(640, 180, 640)).toBe(640);
  });
});
