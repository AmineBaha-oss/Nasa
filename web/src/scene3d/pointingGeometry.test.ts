import { describe, expect, it } from 'vitest';
import type { HorizonProfile } from '../contracts';
import { directionArc, obstructionGeometry } from './pointingGeometry';

// Synthetic angular skyline, used only to test display geometry.
const horizon: HorizonProfile = { observerHeightM: 2, azimuthStepDeg: 90, anglesDeg: [5, 10, 2, 4], extentKm: 3, horizonCoverage: 'local-only', sourceId: null };
describe('pointing guide geometry', () => {
  it('keeps a 180-degree gap finite and on its sphere', () => {
    const points = directionArc([0, 0, -1], [0, 0, 1], 1.3);
    expect(points).toHaveLength(33);
    expect(points[0]).toEqual([0, 0, -1.3]);
    points.forEach(p => expect(Math.hypot(...p)).toBeCloseTo(1.3, 12));
    expect(points.at(-1)![2]).toBeCloseTo(1.3, 12);
  });
  it('does not invent an arc for an absent direction', () => {
    expect(directionArc([0, 0, 0], [1, 0, 0], 1)).toEqual([]);
  });
  it('only marks terrain when the engine reports definite blockage', () => {
    for (const status of ['unknown', 'pass'] as const) expect(obstructionGeometry(horizon, status, 45, 0, 2, 600)).toBeNull();
    expect(obstructionGeometry(horizon, 'fail', 45, 0, 2, 600)).not.toBeNull();
  });
  it('never uses a missing bin or the wrong instrument height', () => {
    expect(obstructionGeometry({ ...horizon, anglesDeg: [5, null, 2, 4] }, 'fail', 45, 0, 2, 600)).toBeNull();
    expect(obstructionGeometry(horizon, 'fail', 45, 0, 3, 600)).toBeNull();
    expect(obstructionGeometry(horizon, 'fail', null, null, 2, 600)).toBeNull();
    expect(obstructionGeometry({ ...horizon, horizonCoverage: 'missing' }, 'fail', 45, 0, 2, 600)).toBeNull();
  });
  it('uses the angular skyline radius and instrument height, including azimuth wrap', () => {
    const geometry = obstructionGeometry(horizon, 'fail', 360, 0, 2, 600)!;
    expect(geometry.target[0]).toBeCloseTo(0, 10);
    expect(geometry.target.slice(1)).toEqual([2, -600]);
    expect(geometry.top[1]).toBeCloseTo(2 + 600 * Math.tan(5 * Math.PI / 180), 10);
  });
});
