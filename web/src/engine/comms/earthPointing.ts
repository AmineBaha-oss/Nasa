import type { Direction, EphemerisSample, HorizonProfile, HardwareConfig, Status } from '../../contracts';

type Vec3 = [number, number, number];
type Check = { status: Status; reason: string };
/** The HardwareConfig fields this engine reads; a full HardwareConfig is accepted. */
export type AntennaHardware = Pick<HardwareConfig, 'antenna' | 'antennaHeightM'>
  & Partial<Pick<HardwareConfig, 'identity' | 'specificationSourceId'>>;

const RAD = Math.PI / 180;
const EPS = 1e-9;
/** Floating-point tolerance for "on the beam edge counts as inside"; far below any physical meaning. */
const ANGLE_TOL_DEG = 1e-9;

export interface EarthPointingResult {
  utc: string;
  /** Combined per-sample status: a definite fail of either check wins, then unknown, then pass. */
  status: Status;
  /** Earth centre above the antenna-height terrain skyline. */
  earthVisible: Status;
  /** Earth inside the antenna beam (fixed) or reachable beam (gimballed). */
  pointing: Status;
  reason: string;
}

/**
 * Geometric Earth-pointing opportunity for one UTC sample and one lander yaw.
 * Geometry only: it never asserts a DSN contact or a radio link budget.
 */
export function evaluateEarthPointing(
  sample: EphemerisSample,
  earthHorizon: HorizonProfile,
  hardware: AntennaHardware,
  yawDeg: number,
): EarthPointingResult {
  const earth = usableEarth(sample);
  const visibility = 'direction' in earth ? checkVisibility(earth.direction, earthHorizon, hardware.antennaHeightM)
    : { status: 'unknown' as Status, reason: `${earth.problem}; visibility unknown.` };
  const pointing = 'direction' in earth ? checkPointing(earth.direction, hardware, yawDeg)
    : { status: 'unknown' as Status, reason: 'Antenna pointing not evaluated without a valid Earth direction.' };
  let reason = `${visibility.reason} ${pointing.reason}`;
  if (sample.ephemerisQuality === 'approximate') reason += ' Approximate ephemeris (not JPL-verified).';
  return {
    utc: sample.utc,
    status: combine(visibility.status, pointing.status),
    earthVisible: visibility.status,
    pointing: pointing.status,
    reason,
  };
}

function usableEarth(sample: EphemerisSample): { direction: Direction } | { problem: string } {
  const e = sample.earth;
  if (sample.ephemerisQuality === 'missing') return { problem: 'Ephemeris quality is "missing"' };
  if (e === null) return { problem: 'Earth direction unavailable (null)' };
  if (!Number.isFinite(e.azDeg) || !Number.isFinite(e.elDeg)) return { problem: `Earth az/el (${e.azDeg}, ${e.elDeg}) not finite` };
  if (e.elDeg < -90 || e.elDeg > 90) return { problem: `Earth elevation ${e.elDeg} deg out of range [-90, 90]` };
  return { direction: e };
}

function checkVisibility(earth: Direction, h: HorizonProfile, antennaHeightM: number): Check {
  const n = h.anglesDeg.length;
  if (h.horizonCoverage === 'missing' || n === 0) {
    return { status: 'unknown', reason: 'Earth-horizon profile missing; visibility unknown.' };
  }
  if (!(h.azimuthStepDeg > 0) || Math.abs(n * h.azimuthStepDeg - 360) > 1e-6) {
    return { status: 'unknown', reason: `Malformed Earth-horizon profile (${n} bins at ${h.azimuthStepDeg} deg step); visibility unknown.` };
  }
  if (!(Math.abs(h.observerHeightM - antennaHeightM) <= 1e-6)) {
    return { status: 'unknown', reason: `Horizon observer height ${fmt(h.observerHeightM)} m differs from antenna height ${fmt(antennaHeightM)} m; visibility unknown.` };
  }
  const sky = skylineBracket(h, earth.azDeg);
  if (!sky) {
    return { status: 'unknown', reason: `No terrain skyline sample at Earth azimuth ${fmt(earth.azDeg)} deg; visibility unknown.` };
  }
  const skyText = sky.min === sky.max ? `${fmt(sky.min)} deg` : `${fmt(sky.min)}..${fmt(sky.max)} deg between horizon samples`;
  if (earth.elDeg > sky.max) {
    const scope = h.horizonCoverage === 'local-only' ? ' Local terrain only; distant obstructions unmodeled.' : '';
    return { status: 'pass', reason: `Earth elevation ${fmt(earth.elDeg)} deg is above the terrain skyline (${skyText}).${scope}` };
  }
  if (earth.elDeg <= sky.min) return { status: 'fail', reason: `Earth elevation ${fmt(earth.elDeg)} deg is at or below the terrain skyline (${skyText}).` };
  return { status: 'unknown', reason: `Earth elevation ${fmt(earth.elDeg)} deg lies within the unresolved skyline range (${skyText}); visibility unknown.` };
}

function antennaProblem(hardware: AntennaHardware, yawDeg: number): string | null {
  const { boresightBodyRFU: b, beamHalfAngleDeg: half } = hardware.antenna;
  if (!b.every(Number.isFinite) || Math.hypot(...b) < EPS) return 'boresight must be a finite non-zero vector';
  if (!(half > 0 && half <= 180)) return `beam half-angle ${half} deg must be in (0, 180]`;
  if (!Number.isFinite(yawDeg)) return `yaw ${yawDeg} is not a finite angle`;
  const g = hardware.antenna.gimbal;
  if (g) {
    if (![g.panMinDeg, g.panMaxDeg, g.tiltMinDeg, g.tiltMaxDeg].every(Number.isFinite)) return 'gimbal limits must be finite';
    if (g.panMinDeg > g.panMaxDeg) return `gimbal pan min ${g.panMinDeg} > max ${g.panMaxDeg}`;
    if (g.tiltMinDeg > g.tiltMaxDeg) return `gimbal tilt min ${g.tiltMinDeg} > max ${g.tiltMaxDeg}`;
    if (g.tiltMinDeg < -90 || g.tiltMaxDeg > 90) return 'gimbal tilt limits must lie within [-90, 90] deg';
  }
  return null;
}

function checkPointing(earth: Direction, hardware: AntennaHardware, yawDeg: number): Check {
  const problem = antennaProblem(hardware, yawDeg);
  if (problem) return { status: 'unknown', reason: `Invalid antenna configuration: ${problem}; pointing unknown.` };
  const earthEnu = azElToEnu(earth.azDeg, earth.elDeg);
  const half = hardware.antenna.beamHalfAngleDeg;
  const g = hardware.antenna.gimbal;
  if (!g) {
    const offDeg = angleBetweenDeg(earthEnu, bodyToEnu(hardware.antenna.boresightBodyRFU, yawDeg));
    return offDeg <= half + ANGLE_TOL_DEG
      ? { status: 'pass', reason: `Fixed antenna: Earth is ${fmt(offDeg)} deg off boresight, inside the ${fmt(half)} deg beam half-angle.` }
      : { status: 'fail', reason: `Fixed antenna: Earth is ${fmt(offDeg)} deg off boresight, outside the ${fmt(half)} deg beam half-angle.` };
  }
  // Gimbal: express Earth as body-frame pan/tilt, find the angle to the closest reachable
  // direction in the pan/tilt box, and test it against the beam half-angle.
  const earthBody = enuToBody(earthEnu, yawDeg);
  const pan = Math.atan2(earthBody[0], earthBody[1]) / RAD;
  const tilt = Math.asin(Math.min(1, Math.max(-1, earthBody[2]))) / RAD;
  const offDeg = angleToGimbalBoxDeg(earthBody, pan, tilt, g);
  const where = `Earth at body pan ${fmt(pan)} deg, tilt ${fmt(tilt)} deg; gimbal pan [${g.panMinDeg}, ${g.panMaxDeg}], tilt [${g.tiltMinDeg}, ${g.tiltMaxDeg}] deg`;
  return offDeg <= half + ANGLE_TOL_DEG
    ? { status: 'pass', reason: `Gimballed antenna: ${where}; reachable within the ${fmt(half)} deg beam half-angle.` }
    : { status: 'fail', reason: `Gimballed antenna: ${where}; Earth is ${fmt(offDeg)} deg outside the reachable pointing, beyond the ${fmt(half)} deg beam half-angle.` };
}

type Gimbal = NonNullable<HardwareConfig['antenna']['gimbal']>;

/**
 * Exact angle from a body-frame direction to the reachable pan/tilt box.
 * For any fixed tilt, the closest reachable pan is the Earth pan itself (if inside the pan range)
 * or one of the two pan stops; so the minimum lies on the Earth-pan meridian (tilt clamped) or on a
 * pan-stop meridian. Along a stop meridian the angle to Earth grows with the circular distance from
 * the full-circle optimum atan2(up, horizontal * cos(dPan)); when that optimum lies "behind" (beyond
 * +/-90), the closest admissible tilt can be either stop, so both stops are candidates too.
 */
function angleToGimbalBoxDeg(body: Vec3, panDeg: number, tiltDeg: number, g: Gimbal): number {
  const clampTilt = (t: number) => Math.min(g.tiltMaxDeg, Math.max(g.tiltMinDeg, t));
  const span = g.panMaxDeg - g.panMinDeg;
  const offset = (((panDeg - g.panMinDeg) % 360) + 360) % 360;
  if (span >= 360 || offset <= span) return angleBetweenDeg(body, panTiltToBody(panDeg, clampTilt(tiltDeg)));
  const horizontal = Math.hypot(body[0], body[1]);
  let best = Infinity;
  for (const stop of [g.panMinDeg, g.panMaxDeg]) {
    const optimum = Math.atan2(body[2], horizontal * Math.cos((panDeg - stop) * RAD)) / RAD;
    for (const t of [clampTilt(optimum), g.tiltMinDeg, g.tiltMaxDeg]) {
      best = Math.min(best, angleBetweenDeg(body, panTiltToBody(stop, t)));
    }
  }
  return best;
}

/** A definite failure of either check decides the sample; otherwise unknown wins over pass. */
function combine(...parts: Status[]): Status {
  if (parts.includes('fail')) return 'fail';
  if (parts.includes('unknown')) return 'unknown';
  return 'pass';
}

/**
 * Skyline bounds at an azimuth. Bin i is a point sample at azimuth i * step (docs/INTERFACES.md).
 * Between two samples the true skyline is not resolved, so return both bracketing values.
 * Null or non-finite samples propagate as null (unknown).
 */
function skylineBracket(h: HorizonProfile, azDeg: number): { min: number; max: number } | null {
  const n = h.anglesDeg.length;
  const pos = (((azDeg % 360) + 360) % 360) / h.azimuthStepDeg;
  let i0 = Math.floor(pos);
  let frac = pos - i0;
  if (1 - frac < EPS) { i0 += 1; frac = 0; }
  const a = finiteOrNull(h.anglesDeg[i0 % n]);
  if (a === null) return null;
  if (frac < EPS) return { min: a, max: a };
  const b = finiteOrNull(h.anglesDeg[(i0 + 1) % n]);
  if (b === null) return null;
  return { min: Math.min(a, b), max: Math.max(a, b) };
}

const finiteOrNull = (x: number | null | undefined): number | null =>
  typeof x === 'number' && Number.isFinite(x) ? x : null;

/** Azimuth clockwise from north, elevation above horizontal -> ENU unit vector (docs/MASTER_PLAN.md section 6). */
function azElToEnu(azDeg: number, elDeg: number): Vec3 {
  const az = azDeg * RAD, el = elDeg * RAD;
  return [Math.cos(el) * Math.sin(az), Math.cos(el) * Math.cos(az), Math.sin(el)];
}

/** Body [right, forward, up] -> ENU for yaw clockwise from north (docs/MASTER_PLAN.md section 6). */
function bodyToEnu([r, f, u]: Vec3, yawDeg: number): Vec3 {
  const y = wrap360(yawDeg) * RAD;
  return [r * Math.cos(y) + f * Math.sin(y), -r * Math.sin(y) + f * Math.cos(y), u];
}

/** Inverse of bodyToEnu: ENU -> body [right, forward, up]. */
function enuToBody([e, n, u]: Vec3, yawDeg: number): Vec3 {
  const y = wrap360(yawDeg) * RAD;
  return [e * Math.cos(y) - n * Math.sin(y), e * Math.sin(y) + n * Math.cos(y), u];
}

/** Body-frame unit vector for gimbal pan (clockwise from forward toward right) and tilt (toward up). */
function panTiltToBody(panDeg: number, tiltDeg: number): Vec3 {
  const p = panDeg * RAD, t = tiltDeg * RAD;
  return [Math.cos(t) * Math.sin(p), Math.cos(t) * Math.cos(p), Math.sin(t)];
}

/** Angle between vectors via atan2(|a x b|, a . b): accurate at tiny and near-180 deg angles. */
function angleBetweenDeg(a: Vec3, b: Vec3): number {
  const cross: Vec3 = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  return Math.atan2(Math.hypot(...cross), dot(a, b)) / RAD;
}

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const wrap360 = (deg: number) => ((deg % 360) + 360) % 360;
const fmt = (x: number) => (Math.round(x * 100) / 100).toString();
