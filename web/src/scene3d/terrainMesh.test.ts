// SYNTHETIC UNIT TESTS ONLY. Grids and site are invented test inputs.
import { describe, expect, it } from 'vitest';
import type { Site, SiteTerrain, TerrainGrid } from '../contracts';
import { lunarToPolarStereo } from '../engine/terrain';
import { buildTerrainMesh, terrainHeightAt, type TerrainMesh } from './terrainMesh';

const site: Site = {
  id: 'syn-1', name: 'synthetic', latitudeDeg: -89, longitudeEastDeg: -90,
  terrainSource: 'synthetic', terrainCoverageKm: 0.02, label: 'synthetic',
};
const p = lunarToPolarStereo(site.latitudeDeg, site.longitudeEastDeg)!;

/** 4x4 grid of 5 m pixels centred on the site; elevation from fn(gridX, gridY) offsets. */
function grid(fn: (dx: number, dy: number) => number | null): TerrainGrid {
  const values: (number | null)[] = [];
  for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) values.push(fn((col - 1.5) * 5, (1.5 - row) * 5));
  return { sourceId: 'synthetic', originXM: p.xM - 10, originYM: p.yM + 10, pixelSizeM: 5, width: 4, height: 4, values, nodata: null };
}
const terrain = (dem: TerrainGrid, slope = grid(() => 3)): SiteTerrain => ({
  schemaVersion: '1.0', purpose: 'synthetic-test', siteId: site.id, provenance: [], dem, slope5m: slope,
});
const mesh = (t: SiteTerrain, ex = 1) => buildTerrainMesh(t, site, ex) as TerrainMesh;
const vertex = (m: TerrainMesh, i: number) => [m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]];

describe('buildTerrainMesh', () => {
  it('flat terrain is level at the lander height and fully triangulated', () => {
    const m = mesh(terrain(grid(() => 500)));
    expect(m.baseElevationM).toBe(500);
    for (let i = 0; i < 16; i++) expect(vertex(m, i)[1]).toBeCloseTo(0, 9);
    expect(m.indices.length).toBe(9 * 6);
    expect(m.unknownPixels).toBe(0);
  });
  it('rotates grid axes into true north: at longitude -90 grid -x is north', () => {
    // At lon -90 the site lies on the grid -x axis, so true north (away from the pole) is grid -x.
    const m = mesh(terrain(grid(dx => 100 - dx)));
    const v = Array.from({ length: 16 }, (_, i) => vertex(m, i));
    const northmost = v.reduce((a, b) => (b[2] < a[2] ? b : a));
    expect(northmost[1]).toBeGreaterThan(0);
    for (const [x, y, z] of v) expect(y).toBeCloseTo(-z, 6);
  });
  it('triangles face up', () => {
    const m = mesh(terrain(grid(() => 0)));
    for (let t = 0; t < m.indices.length; t += 3) {
      const [a, b, c] = [m.indices[t], m.indices[t + 1], m.indices[t + 2]].map(i => vertex(m, i));
      const u = [b[0] - a[0], b[2] - a[2]], w = [c[0] - a[0], c[2] - a[2]];
      expect(u[1] * w[0] - u[0] * w[1]).toBeGreaterThan(0);
    }
  });
  it('vertical exaggeration scales heights only', () => {
    const m1 = mesh(terrain(grid(dx => 100 + dx)));
    const m3 = mesh(terrain(grid(dx => 100 + dx)), 3);
    expect(vertex(m3, 0)[1]).toBeCloseTo(3 * vertex(m1, 0)[1], 6);
    expect(vertex(m3, 0)[0]).toBeCloseTo(vertex(m1, 0)[0], 6);
  });
  it('a missing pixel leaves a hole instead of an interpolated surface', () => {
    const m = mesh(terrain(grid((dx, dy) => (dx === 7.5 && dy === 7.5 ? null : 10))));
    expect(m.unknownPixels).toBe(1);
    expect(m.indices.length).toBe(8 * 6);
  });
  it('carries slope per vertex and NaN for unknown slope', () => {
    const m = mesh(terrain(grid(() => 1), grid((dx) => (dx < 0 ? 4 : null))));
    expect(m.slopeDeg[0]).toBe(4);
    expect(Number.isNaN(m.slopeDeg[3])).toBe(true);
  });
  it('terrainHeightAt samples in true ENU: at longitude -90 north is grid -x', () => {
    const t = terrain(grid(dx => 100 - dx));
    expect(terrainHeightAt(t, site, 0, 5)).toBeCloseTo(5, 9);
    expect(terrainHeightAt(t, site, 5, 0)).toBeCloseTo(0, 9);
    expect(terrainHeightAt(t, site, 0, 5, 2)).toBeCloseTo(10, 9);
    expect(terrainHeightAt(t, site, 0, 500)).toBeNull();
  });
  it('reports a problem without elevation under the lander or for the wrong site', () => {
    expect(buildTerrainMesh(terrain(grid(() => null)), site)).toHaveProperty('problem');
    expect(buildTerrainMesh({ ...terrain(grid(() => 1)), siteId: 'other' }, site)).toHaveProperty('problem');
    expect(buildTerrainMesh(terrain(grid(() => 1)), site, 0)).toHaveProperty('problem');
  });
});
