import { describe, expect, it } from 'vitest';
import { bodyVectorAzimuthDeg, bodyVectorElevationDeg, chooseElevationScale, formatDeg, formatUtc, normalizeDeg, polarPoint, unwrapAngle, yawFromKey, yawFromPointer } from './geometry';

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
  it('reads a heading from a pointer offset (screen y down)', () => {
    expect(yawFromPointer(0, -10)).toBe(0); expect(yawFromPointer(10, 0)).toBe(90);
    expect(yawFromPointer(0, 10)).toBe(180); expect(yawFromPointer(-10, 0)).toBe(270);
    expect(yawFromPointer(0, 0)).toBeNull();
  });
  it('steps the dial with the WAI-ARIA slider keys and wraps', () => {
    expect(yawFromKey('ArrowRight', 359, false)).toBe(0); expect(yawFromKey('ArrowLeft', 0, false)).toBe(359);
    expect(yawFromKey('ArrowUp', 5, true)).toBe(15); expect(yawFromKey('PageDown', 5, false)).toBe(355);
    expect(yawFromKey('Home', 200, false)).toBe(0); expect(yawFromKey('End', 0, false)).toBe(359);
    expect(yawFromKey('a', 10, false)).toBeNull();
  });
  it('unwraps rotation so 359° → 0° turns 1°, not 359°', () => {
    expect(unwrapAngle(359, 0)).toBe(360); expect(unwrapAngle(360, 350)).toBe(350);
    expect(unwrapAngle(10, 190)).toBe(-170); expect(unwrapAngle(720, 90)).toBe(810);
  });
  it('keeps the UTC Z suffix', () => expect(formatUtc('2027-10-01T00:00:00Z')).toBe('2027-10-01 00:00Z'));
});
