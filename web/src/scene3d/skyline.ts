import type { HorizonProfile } from '../contracts';
import type { Vec3 } from '../engine/power';
import { enuToThree } from './frames';

const DEG = Math.PI / 180;

export interface SkylinePoint { azDeg: number; angleDeg: number; position: Vec3 }
/** Consecutive known bins; `closed` when the whole 360 degrees is known. */
export interface SkylineRun { points: SkylinePoint[]; closed: boolean }
export interface Skyline { runs: SkylineRun[]; missingBins: number }

/**
 * Angular skyline as seen from an eye `eyeHeightM` above the lander, drawn at a fixed visual radius:
 * a point at horizon angle a sits R tan(a) above the eye, so it subtends a correctly from the lander.
 * It is not drawn at the terrain's real distance. Null bins are gaps.
 */
export function buildSkyline(h: HorizonProfile, radiusM: number, eyeHeightM: number): Skyline | { problem: string } {
  const n = h.anglesDeg.length;
  if (h.horizonCoverage === 'missing' || n === 0) return { problem: 'Horizon profile missing' };
  if (!(h.azimuthStepDeg > 0) || Math.abs(n * h.azimuthStepDeg - 360) > 1e-6) return { problem: `Malformed horizon (${n} bins at ${h.azimuthStepDeg} deg)` };
  const point = (i: number): SkylinePoint | null => {
    const a = h.anglesDeg[i];
    if (typeof a !== 'number' || !Number.isFinite(a)) return null;
    const azDeg = i * h.azimuthStepDeg, clamped = Math.max(-80, Math.min(80, a));
    const position = enuToThree([radiusM * Math.sin(azDeg * DEG), radiusM * Math.cos(azDeg * DEG), eyeHeightM + radiusM * Math.tan(clamped * DEG)]);
    return { azDeg, angleDeg: a, position };
  };
  const pts = Array.from({ length: n }, (_, i) => point(i));
  const missingBins = pts.filter(p => p === null).length;
  if (missingBins === 0) return { runs: [{ points: pts as SkylinePoint[], closed: true }], missingBins };
  const start = pts.findIndex(p => p === null);
  const runs: SkylineRun[] = [];
  let current: SkylinePoint[] = [];
  for (let k = 1; k <= n; k++) {
    const p = pts[(start + k) % n];
    if (p) current.push(p);
    else if (current.length) { runs.push({ points: current, closed: false }); current = []; }
  }
  if (current.length) runs.push({ points: current, closed: false });
  return { runs, missingBins };
}

/** Wall from `floorY` up to each run's skyline, as indexed triangles facing the lander. */
export function skylineWall(skyline: Skyline, floorY: number): { positions: Float32Array; indices: Uint32Array } {
  const positions: number[] = [], indices: number[] = [];
  for (const run of skyline.runs) {
    const pts = run.closed ? [...run.points, run.points[0]] : run.points;
    const first = positions.length / 3;
    for (const { position: [x, y, z] } of pts) positions.push(x, floorY, z, x, y, z);
    for (let k = 0; k + 1 < pts.length; k++) {
      const b0 = first + 2 * k, t0 = b0 + 1, b1 = b0 + 2, t1 = b0 + 3;
      indices.push(b0, b1, t0, t0, b1, t1);
    }
  }
  return { positions: Float32Array.from(positions), indices: Uint32Array.from(indices) };
}
