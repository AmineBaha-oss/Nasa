import type { Site, SiteTerrain } from '../contracts';
import { azimuthToGridDirection, gridProblem, interpolateAt, lunarToPolarStereo, readPixel, sampleAt } from '../engine/terrain';
import { enuToThree } from './frames';

export interface TerrainMesh {
  /** three.js xyz per DEM pixel centre, metres, relative to the ground under the lander. */
  positions: Float32Array;
  /** Triangles only over 2x2 pixel blocks whose four elevations are all known. */
  indices: Uint32Array;
  /** Slope in degrees at each vertex from slope5m; NaN where unknown. */
  slopeDeg: Float32Array;
  baseElevationM: number;
  /** Largest horizontal distance from the lander to a vertex. */
  radiusM: number;
  unknownPixels: number;
}

/**
 * Terrain height in scene metres at an ENU offset from the lander, relative to the ground under the lander.
 * Null outside the patch, over missing pixels or when the site cannot be projected.
 */
export function terrainHeightAt(terrain: SiteTerrain, site: Site, eastM: number, northM: number, verticalExaggeration = 1): number | null {
  const p = lunarToPolarStereo(site.latitudeDeg, site.longitudeEastDeg);
  const north = p && azimuthToGridDirection(p, 0);
  const east = p && azimuthToGridDirection(p, 90);
  if (!p || !north || !east) return null;
  const base = interpolateAt(terrain.dem, p.xM, p.yM);
  const h = interpolateAt(terrain.dem, p.xM + eastM * east[0] + northM * north[0], p.yM + eastM * east[1] + northM * north[1]);
  return base === null || h === null ? null : (h - base) * verticalExaggeration;
}

/**
 * Local terrain mesh from the per-site DEM patch. Grid "north" on the south-polar stereographic grid is
 * not true north, so offsets are rotated into ENU with the terrain engine's azimuthToGridDirection.
 * Missing pixels are left as holes; nothing is interpolated across them.
 */
export function buildTerrainMesh(terrain: SiteTerrain, site: Site, verticalExaggeration = 1): TerrainMesh | { problem: string } {
  const dem = terrain.dem;
  const bad = gridProblem(dem);
  if (bad) return { problem: `DEM patch unusable: ${bad}` };
  if (terrain.siteId !== site.id) return { problem: `Terrain patch is for ${terrain.siteId}, not ${site.id}` };
  if (!(verticalExaggeration > 0) || !Number.isFinite(verticalExaggeration)) return { problem: `Vertical exaggeration ${verticalExaggeration} must be positive` };
  const p = lunarToPolarStereo(site.latitudeDeg, site.longitudeEastDeg);
  const north = p && azimuthToGridDirection(p, 0);
  const east = p && azimuthToGridDirection(p, 90);
  if (!p || !north || !east) return { problem: `Site ${site.id} position cannot be projected` };
  const base = interpolateAt(dem, p.xM, p.yM);
  if (base === null) return { problem: `No DEM elevation under ${site.id}` };
  const slopeOk = gridProblem(terrain.slope5m) === null;

  const { width, height, pixelSizeM: px } = dem;
  const positions = new Float32Array(width * height * 3);
  const slopeDeg = new Float32Array(width * height).fill(Number.NaN);
  const known = new Uint8Array(width * height);
  let radiusM = 0, unknownPixels = 0;
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const i = row * width + col;
      const gx = dem.originXM + (col + 0.5) * px, gy = dem.originYM - (row + 0.5) * px;
      const dx = gx - p.xM, dy = gy - p.yM;
      const e = dx * east[0] + dy * east[1], n = dx * north[0] + dy * north[1];
      const h = readPixel(dem, row, col);
      if (h === null) unknownPixels++; else known[i] = 1;
      positions.set(enuToThree([e, n, h === null ? 0 : (h - base) * verticalExaggeration]), i * 3);
      radiusM = Math.max(radiusM, Math.hypot(e, n));
      const s = slopeOk ? sampleAt(terrain.slope5m, gx, gy) : null;
      if (s !== null) slopeDeg[i] = s;
    }
  }
  const tris: number[] = [];
  for (let row = 0; row + 1 < height; row++) {
    for (let col = 0; col + 1 < width; col++) {
      const a = row * width + col, b = a + 1, c = a + width, d = c + 1;
      if (known[a] && known[b] && known[c] && known[d]) tris.push(a, c, b, b, c, d);
    }
  }
  return { positions, indices: Uint32Array.from(tris), slopeDeg, baseElevationM: base, radiusM, unknownPixels };
}
