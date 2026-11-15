import { Quaternion, Vector3 } from 'three';
import type { HorizonProfile, Status } from '../contracts';
import type { Vec3 } from '../engine/power';
import { azElToThree } from './frames';

/** Drawing geometry only; never determines engineering pass/fail. Handles opposite directions too. */
export function directionArc(from: Vec3, to: Vec3, radius: number, steps = 32): Vec3[] {
  const a = new Vector3(...from).normalize(), b = new Vector3(...to).normalize();
  if (!a.lengthSq() || !b.lengthSq()) return [];
  const rotation = new Quaternion().setFromUnitVectors(a, b);
  return Array.from({ length: steps + 1 }, (_, i) => a.clone()
    .applyQuaternion(new Quaternion().slerp(rotation, i / steps)).multiplyScalar(radius).toArray());
}

/** Marks only an engine-confirmed obstruction on the angular skyline, never on the local DEM. */
export function obstructionGeometry(h: HorizonProfile, visible: Status, az: number | null, el: number | null, eye: number, radius: number) {
  if (visible !== 'fail' || az === null || el === null || !Number.isFinite(az) || !Number.isFinite(el)
    || h.horizonCoverage === 'missing' || Math.abs(h.observerHeightM - eye) > 1e-6
    || !(h.azimuthStepDeg > 0) || Math.abs(h.anglesDeg.length * h.azimuthStepDeg - 360) > 1e-6) return null;
  const pos = ((az % 360 + 360) % 360) / h.azimuthStepDeg;
  const i = Math.floor(pos), j = Math.abs(pos - i) < 1e-9 ? i : i + 1;
  const a = h.anglesDeg[i % h.anglesDeg.length], b = h.anglesDeg[j % h.anglesDeg.length];
  if (a === null || b === null || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  const point = (bearing: number, elevation: number): Vec3 => {
    const [x, , z] = azElToThree(bearing, 0);
    return [x * radius, eye + radius * Math.tan(Math.max(-80, Math.min(80, elevation)) * Math.PI / 180), z * radius];
  };
  return { edge: [point(i * h.azimuthStepDeg, a), point(j * h.azimuthStepDeg, b)],
    top: point(az, Math.min(a, b)), target: point(az, el) };
}
