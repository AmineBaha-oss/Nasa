// SYNTHETIC UNIT TESTS ONLY. Canonical frame checks, not lunar results.
import { describe, expect, it } from 'vitest';
import { angleBetweenDeg, azElToEnu, bodyToEnu, normalize, wrap360, type Vec3 } from './vectors';

const close = (actual: Vec3, expected: Vec3) => actual.forEach((x, i) => expect(x).toBeCloseTo(expected[i], 12));

describe('azElToEnu (azimuth clockwise from north)', () => {
  it.each([
    [0, 0, [0, 1, 0]],
    [90, 0, [1, 0, 0]],
    [180, 0, [0, -1, 0]],
    [270, 0, [-1, 0, 0]],
    [123, 90, [0, 0, 1]],
  ] as [number, number, Vec3][])('az %d el %d', (az, el, expected) => close(azElToEnu(az, el), expected));
});

describe('bodyToEnu (body right-forward-up, yaw clockwise from north)', () => {
  const forward: Vec3 = [0, 1, 0];
  const right: Vec3 = [1, 0, 0];
  it.each([
    [0, [0, 1, 0], [1, 0, 0]],
    [90, [1, 0, 0], [0, -1, 0]],
    [180, [0, -1, 0], [-1, 0, 0]],
    [270, [-1, 0, 0], [0, 1, 0]],
    [360, [0, 1, 0], [1, 0, 0]],
    [-90, [-1, 0, 0], [0, 1, 0]],
  ] as [number, Vec3, Vec3][])('yaw %d: forward and right rotate to the expected ENU axes', (yaw, f, r) => {
    close(bodyToEnu(forward, yaw), f);
    close(bodyToEnu(right, yaw), r);
  });

  it('leaves body-up unchanged at any yaw', () => close(bodyToEnu([0, 0, 1], 37), [0, 0, 1]));
});

describe('vector helpers', () => {
  it('wraps angles into [0, 360)', () => {
    expect(wrap360(360)).toBe(0);
    expect(wrap360(-90)).toBe(270);
    expect(wrap360(725)).toBe(5);
  });

  it('normalizes non-zero vectors and rejects zero or non-finite ones', () => {
    close(normalize([0, 3, 4])!, [0, 0.6, 0.8]);
    expect(normalize([0, 0, 0])).toBeNull();
    expect(normalize([Number.NaN, 1, 0])).toBeNull();
  });

  it('measures angles accurately near 0 and 180 degrees', () => {
    expect(angleBetweenDeg([1, 0, 0], [1, 1e-9, 0])).toBeCloseTo(5.73e-8, 9);
    expect(angleBetweenDeg([1, 0, 0], [-1, 0, 0])).toBeCloseTo(180, 12);
    expect(angleBetweenDeg([1, 0, 0], [0, 2, 0])).toBeCloseTo(90, 12);
  });
});
