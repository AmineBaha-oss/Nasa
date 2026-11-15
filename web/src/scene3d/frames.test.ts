// SYNTHETIC UNIT TESTS ONLY.
import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { azElToEnu, bodyToEnu, type Vec3 } from '../engine/power';
import { azElToThree, bodyToLocal, enuToThree, groundPointToYawDeg, threeToLocal, yawToRotationY } from './frames';

const close = (a: Vec3, b: Vec3) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 12));

describe('scene frames', () => {
  it('maps north to -z, east to +x and up to +y', () => {
    close(azElToThree(0, 0), [0, 0, -1]);
    close(azElToThree(90, 0), [1, 0, 0]);
    close(azElToThree(123, 90), [0, 1, 0]);
  });
  it('agrees with the engine az/el convention', () => {
    close(azElToThree(217, 14), enuToThree(azElToEnu(217, 14)));
  });
  it('a yawed lander group places body vectors where bodyToEnu puts them', () => {
    const bodies: Vec3[] = [[0, 1, 0], [1, 0, 0], [0.3, -0.7, 0.4]];
    for (const yaw of [0, 37, 90, 180, 271.5]) {
      for (const body of bodies) {
        const local = new Vector3(...bodyToLocal(body)).applyAxisAngle(new Vector3(0, 1, 0), yawToRotationY(yaw));
        close([local.x, local.y, local.z], enuToThree(bodyToEnu(body, yaw)));
      }
    }
  });
  it('groundPointToYawDeg reads azimuth clockwise from north and snaps', () => {
    expect(groundPointToYawDeg(0, -5)).toBe(0);
    expect(groundPointToYawDeg(5, 0)).toBe(90);
    expect(groundPointToYawDeg(0, 5)).toBe(180);
    expect(groundPointToYawDeg(-5, 0)).toBe(270);
    expect(groundPointToYawDeg(-0.01, -5)).toBe(0);
    const [x, , z] = azElToThree(37.4, 0);
    expect(groundPointToYawDeg(x, z)).toBe(37);
    expect(groundPointToYawDeg(x, z, 15)).toBe(30);
    const [x2, , z2] = azElToThree(353, 0);
    expect(groundPointToYawDeg(x2, z2, 15)).toBe(0);
  });
  it('threeToLocal undoes the yaw rotation', () => {
    for (const yaw of [0, 45, 133, 270]) {
      close(threeToLocal(enuToThree(bodyToEnu([0.2, 0.9, -0.1], yaw)), yaw), bodyToLocal([0.2, 0.9, -0.1]));
    }
  });
  it('body forward at yaw 90 points east', () => {
    const f = new Vector3(...bodyToLocal([0, 1, 0])).applyAxisAngle(new Vector3(0, 1, 0), yawToRotationY(90));
    close([f.x, f.y, f.z], [1, 0, 0]);
  });
});
