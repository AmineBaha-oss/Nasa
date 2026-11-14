import type { Direction, EphemerisSample, HorizonProfile, Panel, Status } from '../../contracts';
import type { PowerHardware } from './hardware';
import { angleBetweenDeg, azElToEnu, bodyToEnu, dot, normalize, RAD, type Vec3 } from './vectors';

/** Closed range of a quantity that the inputs do not pin down exactly. */
export interface Interval { low: number; high: number }

/**
 * Mean apparent solar radius: 696,000 km at 1 AU. The Earth-Moon-Sun distance varies it by about
 * +/-1.7 %; that variation is ignored.
 */
export const SUN_ANGULAR_RADIUS_DEG = 0.2666;

const EPS = 1e-9;

/**
 * Cosine-incidence factor in [0, 1] for one panel.
 * Fixed: max(0, n . s). Tracked without a limit: ideal tracking, always 1 (an upper bound).
 * Tracked with maxTrackingAngleDeg: the panel can tilt anywhere inside a cone of that half-angle
 * about its nominal normal, so the residual angle to the Sun is max(0, theta - limit).
 * Terrain blockage is applied separately; a tracker never recovers a blocked Sun.
 */
export function panelIncidence(panel: Panel, sunEnu: Vec3, yawDeg: number): number {
  const n = normalize(bodyToEnu(panel.normalBodyRFU, yawDeg));
  const s = normalize(sunEnu);
  if (!n || !s) return 0;
  if (panel.mode === 'fixed') return Math.max(0, dot(n, s));
  if (panel.maxTrackingAngleDeg === undefined) return 1;
  const excess = angleBetweenDeg(n, s) - panel.maxTrackingAngleDeg;
  if (excess <= 0) return 1;
  return excess >= 90 ? 0 : Math.cos(excess * RAD);
}

/**
 * Fraction of the solar disk above a skyline treated as a straight line across the disk.
 * `centreAboveSkylineDeg` is Sun-centre elevation minus skyline elevation. Uniform disk, no limb darkening.
 */
export function sunDiskVisibleFraction(centreAboveSkylineDeg: number, radiusDeg = SUN_ANGULAR_RADIUS_DEG): number {
  if (centreAboveSkylineDeg >= radiusDeg) return 1;
  if (centreAboveSkylineDeg <= -radiusDeg) return 0;
  const x = centreAboveSkylineDeg / radiusDeg;
  return 1 - (Math.acos(x) - x * Math.sqrt(1 - x * x)) / Math.PI;
}

export interface SunVisibility {
  /** pass: some of the disk is certainly visible; fail: none is; unknown otherwise. */
  status: Status;
  fraction: Interval;
  reason: string;
}

const UNKNOWN_FRACTION: Interval = { low: 0, high: 1 };

/** Visible solar-disk fraction against the terrain skyline sampled at panel height. */
export function sunVisibility(sun: Direction, h: HorizonProfile, panelHeightM: number): SunVisibility {
  const unknown = (why: string): SunVisibility => ({ status: 'unknown', fraction: UNKNOWN_FRACTION, reason: `${why}; Sun visibility unknown.` });
  const n = h.anglesDeg.length;
  if (h.horizonCoverage === 'missing' || n === 0) return unknown('Sun-horizon profile missing');
  if (!(h.azimuthStepDeg > 0) || Math.abs(n * h.azimuthStepDeg - 360) > 1e-6) {
    return unknown(`Malformed Sun-horizon profile (${n} bins at ${h.azimuthStepDeg} deg step)`);
  }
  if (!(Math.abs(h.observerHeightM - panelHeightM) <= 1e-6)) {
    return unknown(`Horizon observer height ${fmt(h.observerHeightM)} m differs from panel height ${fmt(panelHeightM)} m`);
  }
  const sky = skylineBracket(h, sun.azDeg);
  if (!sky) return unknown(`No terrain skyline sample at Sun azimuth ${fmt(sun.azDeg)} deg`);
  const fraction = { low: sunDiskVisibleFraction(sun.elDeg - sky.max), high: sunDiskVisibleFraction(sun.elDeg - sky.min) };
  const skyText = sky.min === sky.max ? `${fmt(sky.min)} deg` : `${fmt(sky.min)}..${fmt(sky.max)} deg between horizon samples`;
  const where = `Sun centre elevation ${fmt(sun.elDeg)} deg vs skyline ${skyText}`;
  if (fraction.low > 0) return { status: 'pass', fraction, reason: `${where}: ${pct(fraction)} of the disk visible.` };
  if (fraction.high === 0) return { status: 'fail', fraction, reason: `${where}: Sun blocked by terrain.` };
  return { status: 'unknown', fraction, reason: `${where}: ${pct(fraction)} of the disk visible; skyline unresolved.` };
}

export interface SolarSampleResult {
  utc: string;
  /** Terrain illumination of the panels at this sample. */
  sunlit: Status;
  /** Area-weighted cosine factor from geometry alone; null without a valid Sun direction. */
  incidence: number | null;
  visibleFraction: Interval;
  /** Direct-sunlight array output bounds, W. */
  powerW: Interval;
  reason: string;
}

/**
 * Array power for one sample: peak * sum(areaFraction * incidence) * visible disk fraction.
 * Unknown inputs widen the interval instead of inventing a value; an unknown Sun direction gives [0, peak].
 * Hardware must already have passed solarHardwareProblem.
 */
export function evaluateSolarSample(sample: EphemerisSample, sunHorizon: HorizonProfile, hardware: PowerHardware, yawDeg: number): SolarSampleResult {
  const peak = hardware.peakSolarPowerW;
  const sun = usableSun(sample);
  if ('problem' in sun) {
    return {
      utc: sample.utc, sunlit: 'unknown', incidence: null, visibleFraction: UNKNOWN_FRACTION,
      powerW: { low: 0, high: peak }, reason: `${sun.problem}; array power bounded by [0, ${fmt(peak)}] W.`,
    };
  }
  const sunEnu = azElToEnu(sun.direction.azDeg, sun.direction.elDeg);
  const incidence = hardware.panels.reduce((s, p) => s + p.areaFraction * panelIncidence(p, sunEnu, yawDeg), 0);
  const vis = sunVisibility(sun.direction, sunHorizon, hardware.panelHeightM);
  const powerW = { low: peak * incidence * vis.fraction.low, high: peak * incidence * vis.fraction.high };
  let reason = `${vis.reason} Incidence factor ${fmt(incidence)}; array ${fmtW(powerW)}.`;
  if (sample.ephemerisQuality === 'approximate') reason += ' Approximate ephemeris (not JPL-verified).';
  return { utc: sample.utc, sunlit: vis.status, incidence, visibleFraction: vis.fraction, powerW, reason };
}

function usableSun(sample: EphemerisSample): { direction: Direction } | { problem: string } {
  const s = sample.sun;
  if (sample.ephemerisQuality === 'missing') return { problem: 'Ephemeris quality is "missing"' };
  if (s === null) return { problem: 'Sun direction unavailable (null)' };
  if (!Number.isFinite(s.azDeg) || !Number.isFinite(s.elDeg)) return { problem: `Sun az/el (${s.azDeg}, ${s.elDeg}) not finite` };
  if (s.elDeg < -90 || s.elDeg > 90) return { problem: `Sun elevation ${s.elDeg} deg out of range [-90, 90]` };
  return { direction: s };
}

/**
 * Skyline bounds at an azimuth. Bin i is a point sample at azimuth i * step (docs/INTERFACES.md).
 * Between two samples the skyline is unresolved, so both bracketing values are returned.
 * Null or non-finite samples give null (unknown).
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

export const fmt = (x: number) => (Math.round(x * 100) / 100).toString();
export const fmtW = (p: Interval) => (p.low === p.high ? `${fmt(p.low)} W` : `${fmt(p.low)}..${fmt(p.high)} W`);
const pct = (f: Interval) => (f.low === f.high ? `${fmt(f.low * 100)}%` : `${fmt(f.low * 100)}..${fmt(f.high * 100)}%`);
