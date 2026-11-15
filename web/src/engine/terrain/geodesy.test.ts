import { describe, it, expect } from 'vitest';
import { lunarToPolarStereo, azimuthToGridDirection } from './index';
import type { ProjectedPoint } from './index';

// Independent oracle: tile corners printed by the NASA publisher in
// data/nasa_a305/A3CLR22_5_Connecting_Ridge_Extension/README.txt (lines 15-18),
// projection "+proj=stere +lon_0=0 +lat_0=-90 +R=1737400 +units=m".
const dms = (d: number, m: number, s: number) => d + m / 60 + s / 3600;
const CORNERS: [string, number, number, number, number][] = [
  // name, latDeg (south negative), lonEastDeg (west negative), xM, yM
  ['upper left', -dms(88, 43, 2.44), -dms(84, 14, 43.56), -38700, 3900],
  ['lower left', -dms(88, 37, 4.03), -dms(112, 35, 17.95), -38700, -16100],
  ['upper right', -dms(89, 22, 12.18), -dms(78, 13, 10.11), -18700, 3900],
  ['lower right', -dms(89, 11, 10.52), -dms(130, 43, 37.99), -18700, -16100],
];

describe('lunarToPolarStereo (geodesy seam)', () => {
  it.each(CORNERS)('reproduces the publisher %s corner to within 0.5 m', (_name, lat, lon, x, y) => {
    const p = lunarToPolarStereo(lat, lon);
    expect(p).not.toBeNull();
    expect(Math.abs(p!.xM - x)).toBeLessThan(0.5);
    expect(Math.abs(p!.yM - y)).toBeLessThan(0.5);
  });

  it('rejects non-finite or out-of-range latitude', () => {
    expect(lunarToPolarStereo(NaN, 0)).toBeNull();
    expect(lunarToPolarStereo(-91, 0)).toBeNull();
  });
});

describe('azimuthToGridDirection (true north is not grid up near the pole)', () => {
  const close = (v: [number, number] | null, e: [number, number], tol = 1e-9) => {
    expect(v).not.toBeNull();
    expect(Math.abs(v![0] - e[0])).toBeLessThan(tol);
    expect(Math.abs(v![1] - e[1])).toBeLessThan(tol);
  };

  it('on the 0 deg meridian (+y axis) north is grid +y and east is grid +x', () => {
    close(azimuthToGridDirection({ xM: 0, yM: 1000 }, 0), [0, 1]);
    close(azimuthToGridDirection({ xM: 0, yM: 1000 }, 90), [1, 0]);
  });

  it('on the 90E meridian (+x axis) north is grid +x and east is grid -y', () => {
    close(azimuthToGridDirection({ xM: 1000, yM: 0 }, 0), [1, 0]);
    close(azimuthToGridDirection({ xM: 1000, yM: 0 }, 90), [0, -1]);
    close(azimuthToGridDirection({ xM: 1000, yM: 0 }, 180), [-1, 0]);
  });

  it('is undefined at the pole itself', () => {
    expect(azimuthToGridDirection({ xM: 0, yM: 0 }, 0)).toBeNull();
  });

  it('at the candidate site, matches finite differences of the validated projection', () => {
    const lat = -89.111829, lon = -102.71398; // Historical preliminary candidate used for this projection regression test.
    const p = lunarToPolarStereo(lat, lon)!;
    const unit = (a: ProjectedPoint, b: ProjectedPoint): [number, number] => {
      const dx = b.xM - a.xM, dy = b.yM - a.yM, n = Math.hypot(dx, dy);
      return [dx / n, dy / n];
    };
    close(azimuthToGridDirection(p, 0), unit(p, lunarToPolarStereo(lat + 1e-5, lon)!), 1e-6);
    close(azimuthToGridDirection(p, 90), unit(p, lunarToPolarStereo(lat, lon + 1e-4)!), 1e-6);
    // True north there points mostly toward grid -x: about 103 deg away from grid "up".
    const north = azimuthToGridDirection(p, 0)!;
    expect(north[0]).toBeLessThan(-0.97);
  });
});
