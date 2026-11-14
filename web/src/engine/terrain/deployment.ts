import type { ConstraintResult, HardwareConfig, Site, Status } from '../../contracts';
import { azimuthToGridDirection, lunarToPolarStereo, type ProjectedPoint } from './geodesy';
import { gridProblem, interpolateAt, readPixel, type RasterGrid, type ValueRange } from './sampling';

/** User-set screening thresholds. They are never a lunar standard; label where they came from. */
export interface DeploymentThresholds {
  maxFootprintSlopeDeg: number;
  maxRampSlopeDeg: number;
  /** Horizontal ramp length on the ground, metres. */
  rampLengthM: number;
  label: string;
}

/** 5 m DEM (A305_GLDELEV_005) and corrected 5 m-baseline slope (A305_GLDTSLP_005_005_lunar_crs), sampled by coordinate. */
export interface TerrainInputs { dem: RasterGrid; slope5m: RasterGrid; }

export type DeploymentHardware = Pick<HardwareConfig, 'rampHeadingBodyDeg' | 'landingFootprintRadiusM'>;

export interface DeploymentResult {
  /** Maps to HeadingEvaluation.deployment. */
  deployment: ConstraintResult;
  unresolved: string[];
  footprint: { status: Status; maxSlopeDeg: number | null; pixels: number; missingPixels: number };
  ramp: { status: Status; azimuthDeg: number | null; slopeDeg: number | null };
}

export const NOT_CERTIFICATION_NOTE = '5 m terrain slope screen only; not a landing-safety certification.';
export const UNRESOLVED_HAZARDS_NOTE =
  'Rocks/boulders (e.g. 15 cm), small craters, footpad-scale and ramp-clearance hazards are below the 5 m grid and unscreened.';
const THRESHOLD_NOTE = 'Slope thresholds are user-set illustrative values; VIPER draft numbers are VIPER-specific, not general lunar standards.';
const QUALITY_NOTE = 'DEM solution quality (MASK image count, SIGM uncertainty) is not screened; NASA pixel slope is not the effective lander slope.';

/** Physical ranges: slope in degrees; elevation relative to the 1737.4 km sphere, metres. */
const SLOPE_RANGE: ValueRange = [0, 90];
const DEM_RANGE: ValueRange = [-1e5, 1e5];
const TOL = 1e-9;

/**
 * Preliminary deployment screen at one site and lander yaw.
 * Footprint: max NASA 5 m slope among slope pixels whose centres lie within the footprint radius
 * (the pixel containing the site always counts). Ramp: DEM rise from the footprint edge over
 * rampLengthM along azimuth yaw + rampHeadingBodyDeg (clockwise from TRUE north); the whole
 * profile must have DEM data. Equality with a threshold passes. Worst wins: fail > unknown > pass.
 */
export function evaluateDeployment(
  site: Site, terrain: TerrainInputs, hardware: DeploymentHardware, yawDeg: number, thresholds: DeploymentThresholds,
): DeploymentResult {
  const unresolved = [NOT_CERTIFICATION_NOTE, UNRESOLVED_HAZARDS_NOTE, THRESHOLD_NOTE, QUALITY_NOTE];
  if (thresholds.label) unresolved.push(`Thresholds: ${thresholds.label}.`);
  const p = lunarToPolarStereo(site.latitudeDeg, site.longitudeEastDeg);
  const footprint = p ? screenFootprint(p, terrain.slope5m, hardware, thresholds)
    : { status: 'unknown' as Status, maxSlopeDeg: null, pixels: 0, missingPixels: 0, reason: 'Site coordinates invalid; footprint unknown.' };
  const ramp = p ? screenRamp(p, terrain.dem, hardware, yawDeg, thresholds)
    : { status: 'unknown' as Status, azimuthDeg: null, slopeDeg: null, reason: 'Site coordinates invalid; ramp unknown.' };

  const status = worst(footprint.status, ramp.status);
  const reason = `Resolved-scale 5 m screen: ${footprint.reason} ${ramp.reason} ${NOT_CERTIFICATION_NOTE}`;
  const traceable = (s: string | null): s is string => typeof s === 'string' && s.trim() !== '';
  const ids = [terrain.slope5m.sourceId, terrain.dem.sourceId];
  const sourceIds = [...new Set(ids.filter(traceable))];
  if (!ids.every(traceable)) unresolved.push('Terrain grid with no source id (untraceable).');
  const { reason: _f, ...fp } = footprint;
  const { reason: _r, ...rp } = ramp;
  return { deployment: { status, reason, sourceIds }, unresolved, footprint: fp, ramp: rp };
}

const validRadius = (r: number | undefined): r is number => r !== undefined && Number.isFinite(r) && r >= 0;

function screenFootprint(p: ProjectedPoint, slope: RasterGrid, hw: DeploymentHardware, t: DeploymentThresholds) {
  const unknown = (reason: string, pixels = 0, missingPixels = 0, maxSlopeDeg: number | null = null) =>
    ({ status: 'unknown' as Status, maxSlopeDeg, pixels, missingPixels, reason });
  const r = hw.landingFootprintRadiusM;
  const thr = t.maxFootprintSlopeDeg;
  if (!validRadius(r)) return unknown('Landing footprint radius not configured or invalid (HARDWARE-004); footprint unknown.');
  if (!(thr > 0) || !Number.isFinite(thr)) return unknown(`Invalid footprint slope threshold ${thr}; footprint unknown.`);
  const problem = gridProblem(slope);
  if (problem) return unknown(`Invalid slope grid (${problem}); footprint unknown.`);

  const px = slope.pixelSizeM;
  const colOf = (x: number) => Math.floor((x - slope.originXM) / px);
  const rowOf = (y: number) => Math.floor((slope.originYM - y) / px);
  const cHome = colOf(p.xM), rHome = rowOf(p.yM);
  const rows = [Math.min(rowOf(p.yM + r), rHome), Math.max(rowOf(p.yM - r), rHome)];
  const cols = [Math.min(colOf(p.xM - r), cHome), Math.max(colOf(p.xM + r), cHome)];
  // Footprint reaching past the tile: unknown, but still scan the in-tile part for a definite exceedance.
  const leavesTile = rows[0] < 0 || cols[0] < 0 || rows[1] >= slope.height || cols[1] >= slope.width;
  let max: number | null = null, pixels = 0, missing = leavesTile ? 1 : 0;
  for (let row = Math.max(0, rows[0]); row <= Math.min(slope.height - 1, rows[1]); row++) {
    for (let col = Math.max(0, cols[0]); col <= Math.min(slope.width - 1, cols[1]); col++) {
      const cx = slope.originXM + (col + 0.5) * px, cy = slope.originYM - (row + 0.5) * px;
      if (!(Math.hypot(cx - p.xM, cy - p.yM) <= r || (row === rHome && col === cHome))) continue;
      pixels++;
      const v = readPixel(slope, row, col, SLOPE_RANGE);
      if (v === null) { missing++; continue; }
      max = max === null ? v : Math.max(max, v);
    }
  }
  const scope = `footprint r=${fmt(r)} m, ${pixels} in-tile slope pixel(s)${leavesTile ? ', extends past the slope tile' : ''}`;
  if (max !== null && max > thr + TOL) {
    return { status: 'fail' as Status, maxSlopeDeg: max, pixels, missingPixels: missing, reason: `Footprint max 5 m slope ${fmt(max)} deg exceeds ${fmt(thr)} deg (${scope}).` };
  }
  if (missing > 0 || max === null) {
    return unknown(`Footprint has missing, invalid or out-of-tile slope data (${scope}); footprint unknown.`, pixels, missing, max);
  }
  return { status: 'pass' as Status, maxSlopeDeg: max, pixels, missingPixels: 0, reason: `Footprint max 5 m slope ${fmt(max)} deg is within ${fmt(thr)} deg (${scope}).` };
}

function screenRamp(p: ProjectedPoint, dem: RasterGrid, hw: DeploymentHardware, yawDeg: number, t: DeploymentThresholds) {
  const unknown = (reason: string, azimuthDeg: number | null = null) =>
    ({ status: 'unknown' as Status, azimuthDeg, slopeDeg: null, reason });
  if (hw.rampHeadingBodyDeg === undefined || !Number.isFinite(hw.rampHeadingBodyDeg)) return unknown('Ramp heading not configured (HARDWARE-004); ramp unknown.');
  if (!Number.isFinite(yawDeg)) return unknown(`Yaw ${yawDeg} is not finite; ramp unknown.`);
  const r0 = hw.landingFootprintRadiusM;
  if (!validRadius(r0)) return unknown('Landing footprint radius not configured or invalid (HARDWARE-004); ramp start unknown; ramp unknown.');
  const L = t.rampLengthM, thr = t.maxRampSlopeDeg;
  if (!(thr > 0) || !Number.isFinite(thr)) return unknown(`Invalid ramp slope threshold ${thr}; ramp unknown.`);
  if (!(L > 0) || !Number.isFinite(L)) return unknown(`Invalid ramp length ${L}; ramp unknown.`);
  const problem = gridProblem(dem);
  if (problem) return unknown(`Invalid DEM grid (${problem}); ramp unknown.`);
  if (L < 2 * dem.pixelSizeM) {
    return unknown(`Ramp length ${fmt(L)} m is shorter than two DEM pixels (${fmt(2 * dem.pixelSizeM)} m); the 5 m grid cannot resolve it; ramp unknown.`);
  }
  const az = wrap360(wrap360(yawDeg) + wrap360(hw.rampHeadingBodyDeg));
  const dir = azimuthToGridDirection(p, az);
  if (!dir) return unknown('Ramp direction undefined at the pole; ramp unknown.', az);
  // Walk the whole profile at half-pixel steps: a hole anywhere along the ramp makes it unknown.
  const steps = Math.ceil(L / (dem.pixelSizeM / 2));
  const z: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const d = r0 + (L * i) / steps;
    const v = interpolateAt(dem, p.xM + dir[0] * d, p.yM + dir[1] * d, DEM_RANGE);
    if (v === null) return unknown(`DEM missing along the ramp toward azimuth ${fmt(az)} deg; ramp unknown.`, az);
    z.push(v);
  }
  const slopeDeg = Math.atan((z[steps] - z[0]) / L) * 180 / Math.PI;
  const what = `Ramp toward azimuth ${fmt(az)} deg (true north) changes ${fmt(slopeDeg)} deg over ${fmt(L)} m`;
  return Math.abs(slopeDeg) <= thr + TOL
    ? { status: 'pass' as Status, azimuthDeg: az, slopeDeg, reason: `${what}, within ${fmt(thr)} deg.` }
    : { status: 'fail' as Status, azimuthDeg: az, slopeDeg, reason: `${what}, exceeding ${fmt(thr)} deg.` };
}

function worst(...s: Status[]): Status {
  if (s.includes('fail')) return 'fail';
  if (s.includes('unknown')) return 'unknown';
  return 'pass';
}

const wrap360 = (deg: number) => ((deg % 360) + 360) % 360;
const fmt = (x: number) => (Math.round(x * 100) / 100).toString();
