import { describe, expect, it } from 'vitest';
import { azElToEnu, bodyToEnu } from '../engine/power/vectors';
import { azElToThree, bodyToThree, enuToThree, yawToRotationY } from './frames';

describe('scene3d frames', () => {
  it('maps ENU east/north/up into three.js x/y/z', () => {
    const east = enuToThree([1, 0, 0]);
    expect(east[0]).toBeCloseTo(1); expect(east[1]).toBeCloseTo(0); expect(east[2]).toBeCloseTo(0);
    expect(enuToThree([0, 1, 0])).toEqual([0, 0, -1]);
    expect(enuToThree([0, 0, 1])).toEqual([0, 1, 0]);
  });

  it('matches engine az/el → ENU after the three.js remap', () => {
    const enu = azElToEnu(90, 0);
    expect(azElToThree(90, 0)[0]).toBeCloseTo(enu[0]);
    expect(azElToThree(90, 0)[1]).toBeCloseTo(enu[2]);
    expect(azElToThree(90, 0)[2]).toBeCloseTo(-enu[1]);
  });

  it('yaw 90° points body-forward toward +X (east)', () => {
    expect(yawToRotationY(90)).toBeCloseTo(-Math.PI / 2);
    const forwardEnu = bodyToEnu([0, 1, 0], 90);
    expect(forwardEnu[0]).toBeCloseTo(1);
    expect(forwardEnu[1]).toBeCloseTo(0);
  });

  it('body right-forward-up maps to three local (+x, -z, +y)', () => {
    const right = bodyToThree([1, 0, 0]);
    expect(right[0]).toBeCloseTo(1); expect(right[1]).toBeCloseTo(0); expect(right[2]).toBeCloseTo(0);
    expect(bodyToThree([0, 1, 0])).toEqual([0, 0, -1]);
    expect(bodyToThree([0, 0, 1])).toEqual([0, 1, 0]);
  });
});
