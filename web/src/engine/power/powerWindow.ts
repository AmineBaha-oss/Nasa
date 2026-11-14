import type { ConstraintResult, EphemerisSample, SiteDateData, Status } from '../../contracts';
import { simulateBattery, type BatteryRun } from './battery';
import { batteryProblem, solarHardwareProblem, type PowerHardware } from './hardware';
import { evaluateSolarSample, fmt, type Interval, type SolarSampleResult } from './solar';

export interface PowerWindowResult {
  /** Maps to HeadingEvaluation.solar: array energy over the window versus load demand. */
  solar: ConstraintResult;
  /** Maps to HeadingEvaluation.battery: minimum reserve held throughout the window. */
  battery: ConstraintResult;
  /** Maps to HeadingEvaluation.minimumBatteryWh. Null unless the inputs pin it to one value. */
  minimumBatteryWh: number | null;
  minimumBatteryWhBounds: Interval | null;
  generatedWh: Interval | null;
  loadWh: number | null;
  /** Stored-energy bounds at each sample, in UTC order, for the battery chart. */
  batterySeries: { utc: string; energyWh: Interval }[];
  /** Caveats to merge into HeadingEvaluation.unresolved. */
  unresolved: string[];
  /** Per-sample detail in UTC order, for charts and traceable reasons. */
  samples: SolarSampleResult[];
}

export const SOLAR_MODEL_NOTE = 'Solar model: direct sunlight only (peak power x area-weighted cosine incidence x visible Sun-disk fraction); mean solar radius, straight skyline across the disk, no limb darkening, dust, temperature, ageing, panel or lander self-shadowing, or electrical losses beyond peakSolarPowerW.';
export const BATTERY_MODEL_NOTE = 'Battery model: constant load served directly; surplus charges at chargeEfficiency, deficit drawn at dischargeEfficiency; trapezoidal integration between ephemeris samples, so terrain events between samples are not resolved.';
export const LOCAL_ONLY_NOTE = 'Sun horizon is local terrain only; distant terrain can only remove sunlight, so a fail stands but a pass may not survive it.';

const UTC_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
/** Parse a contract UTC string; reject anything Date.parse would silently roll over (Feb 30, hour 24). */
const utcMs = (utc: string): number | null => {
  if (!UTC_RE.test(utc)) return null;
  const ms = Date.parse(utc);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString().slice(0, 19) === utc.slice(0, 19) ? ms : null;
};

/**
 * Solar and battery constraints over one site/date window at one lander yaw.
 * Every unknown input (Sun direction, skyline, observer height) widens an interval of array power.
 * The battery model is monotone in input power, so the low and high runs bound the stored energy:
 * battery pass needs the low run to hold the reserve, fail needs the high run to breach it.
 */
export function evaluatePowerWindow(data: SiteDateData, hardware: PowerHardware, yawDeg: number): PowerWindowResult {
  const unresolved = [SOLAR_MODEL_NOTE, BATTERY_MODEL_NOTE];
  if (data.purpose === 'synthetic-test') unresolved.push('Synthetic test data; not a mission result.');
  const localOnly = data.sunHorizon.horizonCoverage === 'local-only';
  if (localOnly) unresolved.push(LOCAL_ONLY_NOTE);
  const approximate = data.samples.some(s => s.ephemerisQuality === 'approximate');
  if (approximate) unresolved.push('Approximate ephemeris (not JPL-verified) in this window.');
  if (hardware.identity !== 'documented') unresolved.push('Hypothetical power hardware (illustrative values); not a real lander specification.');
  for (const p of hardware.panels) {
    if (p.mode === 'tracked' && p.maxTrackingAngleDeg === undefined) {
      unresolved.push(`Panel "${p.name}" is modelled as an ideal unconstrained tracker (upper bound), not a demonstrated mechanism.`);
    }
  }

  const untraceable = data.samples.filter(s => s.sun !== null && s.sourceId === null).map(s => s.utc);
  if (untraceable.length) unresolved.push(`Ephemeris samples with no source id (untraceable): ${untraceable.join(', ')}.`);
  if (data.sunHorizon.horizonCoverage !== 'missing' && data.sunHorizon.sourceId === null) unresolved.push('Sun horizon has no source id (untraceable).');
  const sourceIds = [...new Set([...data.samples.map(s => s.sourceId), data.sunHorizon.sourceId, hardware.specificationSourceId ?? null]
    .filter((id): id is string => id !== null))];
  const known = new Set(data.provenance.map(p => p.id));
  for (const id of sourceIds) if (!known.has(id)) unresolved.push(`Source id "${id}" has no provenance record.`);

  const empty = (reason: string, samples: SolarSampleResult[] = []): PowerWindowResult => {
    const unknown: ConstraintResult = { status: 'unknown', reason, sourceIds };
    return {
      solar: unknown, battery: unknown, minimumBatteryWh: null, minimumBatteryWhBounds: null,
      generatedWh: null, loadWh: null, batterySeries: [], unresolved, samples,
    };
  };

  const hardwareIssue = solarHardwareProblem(hardware) ?? (Number.isFinite(yawDeg) ? null : `yaw ${yawDeg} is not a finite angle`);
  if (hardwareIssue) return empty(`Invalid power configuration: ${hardwareIssue}; solar and battery unknown.`);

  const timed = data.samples.map(s => ({ s, ms: utcMs(s.utc) }));
  const utcValid = timed.every(t => t.ms !== null);
  if (!utcValid) unresolved.push('Some sample UTC strings are not valid ISO 8601 UTC ending in Z; energy not integrated.');
  const sorted = utcValid ? [...timed].sort((a, b) => a.ms! - b.ms!) : timed;
  const duplicates = utcValid && sorted.some((t, i) => i > 0 && t.ms === sorted[i - 1].ms);
  if (duplicates) unresolved.push('Duplicate sample UTC timestamps; energy not integrated.');
  const ordered: EphemerisSample[] = sorted.map(t => t.s);
  const samples = ordered.map(s => evaluateSolarSample(s, data.sunHorizon, hardware, yawDeg));

  if (!utcValid || duplicates) return empty('Sample times are invalid or duplicated; solar and battery unknown.', samples);
  if (samples.length < 2) return empty(`${samples.length} ephemeris sample(s) give no duration; solar and battery unknown.`, samples);

  const t0 = sorted[0].ms!;
  const hours = sorted.map(t => (t.ms! - t0) / 3_600_000);
  const totalHours = hours[hours.length - 1];
  const generatedWh = { low: trapezoid(hours, samples.map(s => s.powerW.low)), high: trapezoid(hours, samples.map(s => s.powerW.high)) };
  const loadWh = hardware.constantLoadW * totalHours;
  const solar = solarResult(generatedWh, loadWh, totalHours, yawDeg, localOnly, approximate, sourceIds);

  const base = { solar, generatedWh, loadWh, unresolved, samples };
  const batteryIssue = batteryProblem(hardware);
  if (batteryIssue) {
    return {
      ...base, battery: { status: 'unknown', reason: `Invalid battery configuration: ${batteryIssue}; battery unknown.`, sourceIds },
      minimumBatteryWh: null, minimumBatteryWhBounds: null, batterySeries: [],
    };
  }
  const low = simulateBattery(hours.map((h, i) => ({ hours: h, powerW: samples[i].powerW.low })), hardware);
  const high = simulateBattery(hours.map((h, i) => ({ hours: h, powerW: samples[i].powerW.high })), hardware);
  const bounds = { low: low.minimumWh, high: high.minimumWh };
  return {
    ...base,
    battery: batteryResult(low, high, samples, hardware.minReserveWh, yawDeg, localOnly, approximate, sourceIds),
    minimumBatteryWh: same(bounds.low, bounds.high) ? bounds.low : null,
    minimumBatteryWhBounds: bounds,
    batterySeries: samples.map((s, i) => ({ utc: s.utc, energyWh: { low: low.energyWh[i], high: high.energyWh[i] } })),
  };
}

function solarResult(gen: Interval, loadWh: number, hours: number, yawDeg: number, localOnly: boolean, approximate: boolean, sourceIds: string[]): ConstraintResult {
  const span = `over ${fmt(hours)} h at yaw ${fmt(yawDeg)} deg`;
  let status: Status;
  let reason: string;
  if (gen.low >= loadWh) {
    status = 'pass';
    reason = `Array energy ${fmtWh(gen)} covers load demand ${fmt(loadWh)} Wh ${span}.`;
  } else if (gen.high < loadWh) {
    status = 'fail';
    reason = gen.low === gen.high
      ? `Array energy ${fmtWh(gen)} is below load demand ${fmt(loadWh)} Wh ${span}.`
      : `Load demand ${fmt(loadWh)} Wh exceeds array energy even at its upper bound ${fmt(gen.high)} Wh ${span}.`;
  } else {
    status = 'unknown';
    reason = `Array energy ${fmtWh(gen)} brackets load demand ${fmt(loadWh)} Wh ${span}; unresolved Sun or terrain inputs decide it.`;
  }
  return { status, reason: reason + caveats(status, localOnly, approximate), sourceIds };
}

function batteryResult(low: BatteryRun, high: BatteryRun, samples: SolarSampleResult[], reserveWh: number, yawDeg: number,
  localOnly: boolean, approximate: boolean, sourceIds: string[]): ConstraintResult {
  const at = `at yaw ${fmt(yawDeg)} deg`;
  const minText = same(low.minimumWh, high.minimumWh) ? `${fmt(low.minimumWh)} Wh` : `${fmt(low.minimumWh)}..${fmt(high.minimumWh)} Wh`;
  let status: Status;
  let reason: string;
  if (low.firstBreachIndex === null) {
    status = 'pass';
    reason = `Stored energy stays at or above the ${fmt(reserveWh)} Wh reserve ${at}; minimum ${minText}.`;
  } else if (high.firstBreachIndex !== null) {
    status = 'fail';
    const bound = same(low.minimumWh, high.minimumWh) && low.firstBreachIndex === high.firstBreachIndex ? '' : ' even with upper-bound array power';
    reason = `Stored energy falls below the ${fmt(reserveWh)} Wh reserve at ${samples[high.firstBreachIndex].utc}${bound} ${at}; minimum ${minText}.`;
    if (high.shortfallWh > 0) reason += ` Battery empty: ${fmt(high.shortfallWh)} Wh of load unserved.`;
    reason += high.recoveredIndex === null ? ' Not recovered by window end.' : ` Recovered by ${samples[high.recoveredIndex].utc}.`;
  } else {
    status = 'unknown';
    reason = `Reserve ${fmt(reserveWh)} Wh holds with upper-bound array power but is breached at ${samples[low.firstBreachIndex].utc} with lower-bound power ${at}; unresolved Sun or terrain inputs decide it.`;
  }
  return { status, reason: reason + caveats(status, localOnly, approximate), sourceIds };
}

function caveats(status: Status, localOnly: boolean, approximate: boolean): string {
  let text = '';
  if (status === 'pass' && localOnly) text += ' Local terrain only; distant terrain could remove sunlight.';
  if (approximate) text += ' Approximate ephemeris (not JPL-verified).';
  return text;
}

function trapezoid(hours: number[], values: number[]): number {
  let sum = 0;
  for (let i = 1; i < hours.length; i++) sum += (values[i - 1] + values[i]) / 2 * (hours[i] - hours[i - 1]);
  return sum;
}

const same = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
const fmtWh = (e: Interval) => (same(e.low, e.high) ? `${fmt(e.low)} Wh` : `${fmt(e.low)}..${fmt(e.high)} Wh`);
