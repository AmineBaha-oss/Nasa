import type { Vec3 } from '../engine/power/vectors';
import { RAD, wrap360 } from '../engine/power/vectors';

function nz(v: number): number {
  return Object.is(v, -0) ? 0 : v;
}

/** Map ENU (east, north, up) into three.js Y-up: x=E, y=U, z=-N (docs/3D_PLAN.md). */
export function enuToThree([e, n, u]: Vec3): [number, number, number] {
  return [nz(e), nz(u), nz(-n)];
}

/** Azimuth clockwise from north, elevation above horizontal → three.js direction. */
export function azElToThree(azDeg: number, elDeg: number): [number, number, number] {
  const az = azDeg * RAD, el = elDeg * RAD;
  return enuToThree([Math.cos(el) * Math.sin(az), Math.cos(el) * Math.cos(az), Math.sin(el)]);
}

/** Lander yaw clockwise from north seen from above → three.js rotation.y. */
export function yawToRotationY(yawDeg: number): number {
  return -wrap360(yawDeg) * RAD;
}

/** Body right-forward-up → three.js local axes at yaw 0: (+x, -z, +y). */
export function bodyToThree([r, f, u]: Vec3): [number, number, number] {
  return [nz(r), nz(u), nz(-f)];
}
