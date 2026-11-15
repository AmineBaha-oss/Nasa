// SYNTHETIC UNIT TESTS ONLY.
import { describe, expect, it } from 'vitest';
import type { HorizonProfile } from '../contracts';
import { buildSkyline, skylineWall, type Skyline } from './skyline';

const horizon = (anglesDeg: (number | null)[]): HorizonProfile => ({
  observerHeightM: 2, azimuthStepDeg: 360 / anglesDeg.length, anglesDeg, extentKm: 1, horizonCoverage: 'local-only', sourceId: 'synthetic',
});

describe('buildSkyline', () => {
  it('places each bin at its azimuth with the angle it subtends from the eye', () => {
    const s = buildSkyline(horizon([45, 0, 0, 0]), 100, 2) as Skyline;
    expect(s.runs).toHaveLength(1);
    expect(s.runs[0].closed).toBe(true);
    const [north, east] = s.runs[0].points;
    expect(north.position[2]).toBeCloseTo(-100, 9);
    expect(north.position[1]).toBeCloseTo(102, 9);
    expect(east.position[0]).toBeCloseTo(100, 9);
    expect(east.position[1]).toBeCloseTo(2, 9);
  });
  it('splits at null bins and joins runs across 0 degrees', () => {
    const s = buildSkyline(horizon([1, 2, null, 3, 4, null, 5, 6]), 10, 0) as Skyline;
    expect(s.missingBins).toBe(2);
    expect(s.runs.map(r => r.points.map(p => p.angleDeg))).toEqual([[3, 4], [5, 6, 1, 2]]);
    expect(s.runs.every(r => !r.closed)).toBe(true);
  });
  it('reports missing or malformed profiles as problems', () => {
    expect(buildSkyline({ ...horizon([1, 2]), horizonCoverage: 'missing' }, 10, 0)).toHaveProperty('problem');
    expect(buildSkyline({ ...horizon([1, 2, 3]), azimuthStepDeg: 90 }, 10, 0)).toHaveProperty('problem');
    expect(buildSkyline(horizon([]), 10, 0)).toHaveProperty('problem');
  });
  it('an all-null profile gives no runs', () => {
    expect((buildSkyline(horizon([null, null]), 10, 0) as Skyline).runs).toEqual([]);
  });
});

describe('skylineWall', () => {
  it('closes a full ring and builds two triangles per segment', () => {
    const s = buildSkyline(horizon([0, 0, 0, 0]), 10, 0) as Skyline;
    const w = skylineWall(s, -5);
    expect(w.positions.length).toBe(5 * 2 * 3);
    expect(w.indices.length).toBe(4 * 6);
  });
  it('does not bridge gaps', () => {
    const s = buildSkyline(horizon([0, 0, null, 0]), 10, 0) as Skyline;
    expect(skylineWall(s, -5).indices.length).toBe(2 * 6);
  });
});
