export type Vec3 = [number, number, number];

export const RAD = Math.PI / 180;

export const wrap360 = (deg: number): number => ((deg % 360) + 360) % 360;

export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Azimuth clockwise from north, elevation above horizontal -> ENU unit vector (docs/MASTER_PLAN.md section 6). */
export function azElToEnu(azDeg: number, elDeg: number): Vec3 {
  const az = azDeg * RAD, el = elDeg * RAD;
  return [Math.cos(el) * Math.sin(az), Math.cos(el) * Math.cos(az), Math.sin(el)];
}

/** Body [right, forward, up] -> ENU for yaw clockwise from north (docs/MASTER_PLAN.md section 6). */
export function bodyToEnu([r, f, u]: Vec3, yawDeg: number): Vec3 {
  const y = wrap360(yawDeg) * RAD;
  return [r * Math.cos(y) + f * Math.sin(y), -r * Math.sin(y) + f * Math.cos(y), u];
}

export function normalize(v: Vec3): Vec3 | null {
  const n = Math.hypot(...v);
  if (!Number.isFinite(n) || n < 1e-12) return null;
  return [v[0] / n, v[1] / n, v[2] / n];
}

/** Angle between vectors via atan2(|a x b|, a . b): accurate at tiny and near-180 deg angles. */
export function angleBetweenDeg(a: Vec3, b: Vec3): number {
  const cross: Vec3 = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  return Math.atan2(Math.hypot(...cross), dot(a, b)) / RAD;
}
