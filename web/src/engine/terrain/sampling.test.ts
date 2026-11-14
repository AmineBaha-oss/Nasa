// SYNTHETIC UNIT TESTS ONLY: small grids that mimic the A305 geometry, not NASA values.
import { describe, it, expect } from 'vitest';
import { sampleAt, interpolateAt, gridProblem } from './index';
import type { RasterGrid } from './index';

// Each pixel stores 1000 * row + col, so a sampled value reveals which pixel was read.
/** Test-local grid whose pixels the tests may edit in place. */
type MutableGrid = RasterGrid & { values: (number | null)[] };

const encoded = (originXM: number, originYM: number, size: number, sourceId: string): MutableGrid => ({
  sourceId, originXM, originYM, pixelSizeM: 5, width: size, height: size,
  values: Array.from({ length: size * size }, (_, i) => 1000 * Math.floor(i / size) + (i % size)),
});

// Same origins as the real files (data/provenance/DATA_MANIFEST.json): DEM corner (-38700, 3900),
// 5 m slope corner (-38675, 3875) - inset 25 m = 5 pixels on each side.
const dem = encoded(-38700, 3900, 20, 'dem');
const slope = encoded(-38675, 3875, 10, 'slope');

describe('sampleAt (sampling seam: by projected coordinate, never by array index)', () => {
  it('co-locates the 25 m inset: slope pixel (0,0) is DEM pixel (5,5)', () => {
    const x = -38672.5, y = 3872.5; // centre of slope pixel (row 0, col 0)
    expect(sampleAt(slope, x, y)).toBe(0);
    expect(sampleAt(dem, x, y)).toBe(5005);
  });

  it('reads the pixel that contains the point (rows count down from the top edge)', () => {
    expect(sampleAt(dem, -38700 + 3 * 5 + 1, 3900 - 7 * 5 - 1)).toBe(7003);
  });

  it('tile edges are half-open: left/top edge inside, right/bottom edge outside', () => {
    expect(sampleAt(dem, -38700, 3900)).toBe(0);
    expect(sampleAt(dem, -38700 + 20 * 5, 3900)).toBeNull();
    expect(sampleAt(dem, -38700, 3900 - 20 * 5)).toBeNull();
    expect(sampleAt(dem, -38700 + 20 * 5 - 1e-6, 3900 - 20 * 5 + 1e-6)).toBe(19019);
  });

  it('outside the tile (the DEM border the slope inset does not cover) -> null', () => {
    expect(sampleAt(slope, -38690, 3890)).toBeNull(); // inside DEM, outside slope
    expect(sampleAt(dem, -38690, 3890)).toBe(2002);
    expect(sampleAt(dem, 0, 0)).toBeNull();
  });

  it('nodata sentinel, NaN and null pixels -> null (unknown, never zero)', () => {
    const g: RasterGrid = { ...encoded(0, 10, 2, 'g'), nodata: -3.4028234663852886e38 };
    g.values = [-3.4028234663852886e38, NaN, null, 7];
    expect(sampleAt(g, 2, 8)).toBeNull();
    expect(sampleAt(g, 7, 8)).toBeNull();
    expect(sampleAt(g, 2, 3)).toBeNull();
    expect(sampleAt(g, 7, 3)).toBe(7);
  });

  it('non-finite coordinates -> null', () => {
    expect(sampleAt(dem, NaN, 3890)).toBeNull();
  });

  it('the float32 sentinel is missing even with nodata omitted, given as a manifest string, or rounded', () => {
    const S = -3.4028234663852886e38;
    const g = (nodata: RasterGrid['nodata']): RasterGrid => ({ ...encoded(0, 10, 2, 'g'), values: [S, S, S, 7], nodata });
    for (const nd of [undefined, '-3.4028234663852886e+38', -3.40282e38]) {
      expect(sampleAt(g(nd), 2, 8)).toBeNull();
      expect(sampleAt(g(nd), 7, 3)).toBe(7);
    }
  });

  it('an optional physical range turns impossible values into missing', () => {
    const g: RasterGrid = { ...encoded(0, 10, 2, 'g'), values: [-1, 95, 45, 0] };
    expect(sampleAt(g, 2, 8, [0, 90])).toBeNull();
    expect(sampleAt(g, 7, 8, [0, 90])).toBeNull();
    expect(sampleAt(g, 2, 3, [0, 90])).toBe(45);
    expect(sampleAt(g, 7, 3, [0, 90])).toBe(0);
  });

  it('malformed grids are never read', () => {
    expect(sampleAt({ ...dem, pixelSizeM: 0 }, -38690, 3890)).toBeNull();
    expect(sampleAt({ ...dem, width: 19 }, -38690, 3890)).toBeNull();
    expect(gridProblem({ ...dem, width: 19 })).toMatch(/length/);
    expect(gridProblem(dem)).toBeNull();
  });
});

describe('interpolateAt (bilinear between pixel centres, for DEM profiles)', () => {
  // Pixel (row r, col c) has centre x = -38700 + 5c + 2.5, y = 3900 - 5r - 2.5, value 1000r + c.
  const cx = (c: number) => -38700 + 5 * c + 2.5, cy = (r: number) => 3900 - 5 * r - 2.5;

  it('returns the pixel value at a pixel centre', () => {
    expect(interpolateAt(dem, cx(4), cy(6))).toBeCloseTo(6004, 9);
  });

  it('is exact for a field linear in row and column', () => {
    expect(interpolateAt(dem, cx(3.5), cy(2))).toBeCloseTo(2003.5, 9);
    expect(interpolateAt(dem, cx(3.25), cy(2.75))).toBeCloseTo(2753.25, 9);
  });

  it('any missing corner pixel -> null', () => {
    const g = structuredClone(dem);
    g.values[2 * 20 + 4] = null; // row 2, col 4
    expect(interpolateAt(g, cx(3.5), cy(2.5))).toBeNull();
    expect(interpolateAt(g, cx(7.5), cy(2.5))).not.toBeNull();
  });

  it('outside the span of pixel centres (outer half-pixel ring) -> null', () => {
    expect(interpolateAt(dem, -38700 + 1, cy(3))).toBeNull();
    expect(interpolateAt(dem, cx(19), cy(19))).toBeCloseTo(19019, 9);
  });
});
