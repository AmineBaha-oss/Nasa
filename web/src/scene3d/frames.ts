import { azElToEnu, type Vec3 } from '../engine/power';

/**
 * three.js is Y-up. World ENU maps to three as x = East, y = Up, z = -North (docs/3D_PLAN.md).
 * Lander-local body right-forward-up maps to (+x, -z, +y) before the yaw rotation about +y.
 */
const DEG = Math.PI / 180;

export const enuToThree = ([e, n, u]: Vec3): Vec3 => [e, u, -n];

export const azElToThree = (azDeg: number, elDeg: number): Vec3 => enuToThree(azElToEnu(azDeg, elDeg));

/** Yaw is clockwise from north seen from above; three's rotation.y is counter-clockwise seen from above. */
export const yawToRotationY = (yawDeg: number): number => -yawDeg * DEG;

export const bodyToLocal = ([r, f, u]: Vec3): Vec3 => [r, u, -f];

/** Azimuth clockwise from north of a ground-plane point (three x = east, z = -north), snapped and wrapped to [0, 360). */
export function groundPointToYawDeg(x: number, z: number, snapDeg = 1): number {
  const az = Math.atan2(x, -z) / DEG;
  const snapped = Math.round(az / snapDeg) * snapDeg;
  return ((snapped % 360) + 360) % 360;
}

/** World three.js vector into the lander group's local frame (inverse of the yaw rotation). */
export function threeToLocal([x, y, z]: Vec3, yawDeg: number): Vec3 {
  const a = yawDeg * DEG, c = Math.cos(a), s = Math.sin(a);
  return [x * c + z * s, y, -x * s + z * c];
}
