import { describe, expect, it } from 'vitest';
import { bodyVectorAzimuthDeg, bodyVectorElevationDeg, chooseElevationScale, formatDeg, formatUtc, normalizeDeg, polarPoint } from './geometry';

const scale = { minElDeg: -10, maxElDeg: 10 };
const close = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(1e-9);

describe('display geometry (synthetic unit tests only)', () => {
  it('wraps headings into [0, 360)', () => {
    expect(normalizeDeg(-10)).toBe(350); expect(normalizeDeg(360)).toBe(0); expect(normalizeDeg(725)).toBe(5);
  });
  it('puts north up and east right, azimuth clockwise', () => {
    const n = polarPoint(0, -10, 100, 100, 50, scale); close(n.x, 100); close(n.y, 50);
    const e = polarPoint(90, -10, 100, 100, 50, scale); close(e.x, 150); close(e.y, 100);
    const s = polarPoint(180, -10, 100, 100, 50, scale); close(s.y, 150);
    const w = polarPoint(270, -10, 100, 100, 50, scale); close(w.x, 50);
  });
  it('maps max elevation to the centre and clamps out-of-range values', () => {
    const c = polarPoint(45, 10, 100, 100, 50, scale); close(c.x, 100); close(c.y, 100);
    const clamped = polarPoint(0, -40, 100, 100, 50, scale); close(clamped.y, 50);
  });
  it('reads body RFU azimuth clockwise from forward', () => {
    expect(bodyVectorAzimuthDeg([0, 1, 0])).toBe(0);
    expect(bodyVectorAzimuthDeg([1, 0, 0])).toBe(90);
    expect(bodyVectorAzimuthDeg([0, -1, 0])).toBe(180);
    expect(bodyVectorAzimuthDeg([-1, 0, 0])).toBe(270);
    expect(bodyVectorAzimuthDeg([0, 0, 1])).toBeNull();
    close(bodyVectorElevationDeg([0, 1, 1]), 45);
  });
  it('keeps unknown values unknown', () => {
    expect(formatDeg(null)).toBe('unknown'); expect(formatDeg(Number.NaN)).toBe('unknown');
    expect(chooseElevationScale([null, undefined])).toEqual({ minElDeg: -5, maxElDeg: 15 });
    expect(chooseElevationScale([22, -7])).toEqual({ minElDeg: -10, maxElDeg: 30 });
  });
  it('keeps the UTC Z suffix', () => expect(formatUtc('2027-10-01T00:00:00Z')).toBe('2027-10-01 00:00Z'));
});
