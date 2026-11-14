/**
 * A north-up raster on the Moon south polar stereographic grid (metres), as sampled from a NASA GeoTIFF.
 * Equivalent GDAL geotransform: [pixelSizeM, 0, originXM, 0, -pixelSizeM, originYM].
 * Engine-local type: contract v1.0 has no terrain-sample type (decision pending with the lead).
 * Producers must clip windows to the source raster or fill outside with null/NaN, never 0.
 */
export interface RasterGrid {
  sourceId: string | null;
  /** Top-left corner of the top-left pixel. */
  originXM: number;
  originYM: number;
  /** Positive pixel size in metres. */
  pixelSizeM: number;
  width: number;
  height: number;
  /** Row-major, row 0 at the top (largest y); length width * height. Null / NaN / nodata are unknown. */
  values: ArrayLike<number | null>;
  /** Declared nodata. Manifest strings such as "-3.4028234663852886e+38" are accepted. */
  nodata?: number | string | null;
}

/** Inclusive physical range; values outside it are treated as missing. */
export type ValueRange = readonly [number, number];

/** Values at or beyond this magnitude are float32-extreme sentinels, never real terrain. */
const SENTINEL_MAGNITUDE = 3.0e38;

/** Null if the grid is usable, otherwise the reason it is not. */
export function gridProblem(g: RasterGrid): string | null {
  if (!Number.isFinite(g.originXM) || !Number.isFinite(g.originYM)) return 'non-finite origin';
  if (!(g.pixelSizeM > 0) || !Number.isFinite(g.pixelSizeM)) return `pixel size ${g.pixelSizeM} must be a positive finite number`;
  if (!Number.isInteger(g.width) || !Number.isInteger(g.height) || g.width <= 0 || g.height <= 0) return `size ${g.width}x${g.height} must be positive integers`;
  if (!g.values || g.values.length !== g.width * g.height) return `values length ${g.values?.length} != width*height ${g.width * g.height}`;
  return null;
}

/** Value of the pixel containing (x, y); half-open pixels. Null outside the grid, for missing data or an invalid grid. */
export function sampleAt(grid: RasterGrid, xM: number, yM: number, range?: ValueRange): number | null {
  if (!Number.isFinite(xM) || !Number.isFinite(yM) || gridProblem(grid)) return null;
  const col = Math.floor((xM - grid.originXM) / grid.pixelSizeM);
  const row = Math.floor((grid.originYM - yM) / grid.pixelSizeM);
  if (col < 0 || row < 0 || col >= grid.width || row >= grid.height) return null;
  return readPixel(grid, row, col, range);
}

/**
 * Bilinear interpolation between the four surrounding pixel centres.
 * Null if any needed pixel is missing, the point lies outside the span of pixel centres, or the grid is invalid.
 */
export function interpolateAt(grid: RasterGrid, xM: number, yM: number, range?: ValueRange): number | null {
  if (!Number.isFinite(xM) || !Number.isFinite(yM) || gridProblem(grid)) return null;
  const fc = (xM - grid.originXM) / grid.pixelSizeM - 0.5;
  const fr = (grid.originYM - yM) / grid.pixelSizeM - 0.5;
  const c0 = Math.floor(fc), r0 = Math.floor(fr);
  const tx = fc - c0, ty = fr - r0;
  const c1 = tx < 1e-9 ? c0 : c0 + 1, r1 = ty < 1e-9 ? r0 : r0 + 1;
  if (c0 < 0 || r0 < 0 || c1 >= grid.width || r1 >= grid.height) return null;
  const v00 = readPixel(grid, r0, c0, range), v01 = readPixel(grid, r0, c1, range);
  const v10 = readPixel(grid, r1, c0, range), v11 = readPixel(grid, r1, c1, range);
  if (v00 === null || v01 === null || v10 === null || v11 === null) return null;
  return (v00 * (1 - tx) + v01 * tx) * (1 - ty) + (v10 * (1 - tx) + v11 * tx) * ty;
}

/**
 * One pixel by (row, col), already known to be inside the grid. Missing (null) when the value is
 * null/non-finite, a float32-extreme sentinel, equal to the declared nodata (compared at float32
 * precision, so rounded forms such as -3.40282e38 match), or outside the given physical range.
 */
export function readPixel(grid: RasterGrid, row: number, col: number, range?: ValueRange): number | null {
  const v = grid.values[row * grid.width + col];
  if (typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) >= SENTINEL_MAGNITUDE) return null;
  const nd = grid.nodata === undefined || grid.nodata === null ? null : Number(grid.nodata);
  if (nd !== null && Number.isFinite(nd) && (v === nd || Math.fround(v) === Math.fround(nd) || Math.abs(v - nd) <= 1e-5 * Math.abs(nd))) return null;
  if (range && (v < range[0] || v > range[1])) return null;
  return v;
}
