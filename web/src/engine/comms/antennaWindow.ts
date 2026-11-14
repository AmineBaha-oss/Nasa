import type { ConstraintResult, EphemerisSample, SiteDateData, Status } from '../../contracts';
import { evaluateEarthPointing, type AntennaHardware, type EarthPointingResult } from './earthPointing';

export interface AntennaWindowResult {
  /** Maps to HeadingEvaluation.antenna. */
  antenna: ConstraintResult;
  /** Maps to HeadingEvaluation.contactHours. Null when it cannot be measured honestly. */
  contactHours: number | null;
  /** Caveats to merge into HeadingEvaluation.unresolved. */
  unresolved: string[];
  /** Per-sample detail in UTC order, for charts and traceable fail reasons. */
  samples: EarthPointingResult[];
}

export const GEOMETRY_ONLY_NOTE = 'Geometric Earth-centre pointing only; not a DSN contact or radio link budget.';
export const LOCAL_ONLY_NOTE = 'Earth horizon is local terrain only; distant obstructions unmodeled, so local visibility is not guaranteed Earth access.';

const UTC_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
/** Parse a contract UTC string; reject anything Date.parse would silently roll over (Feb 30, hour 24). */
const utcMs = (utc: string): number | null => {
  if (!UTC_RE.test(utc)) return null;
  const ms = Date.parse(utc);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString().slice(0, 19) === utc.slice(0, 19) ? ms : null;
};

/**
 * Antenna constraint over one site/date window at one lander yaw.
 * Window status: any sample fail -> fail; else any unknown -> unknown; else pass (continuous pointing).
 * contactHours: sum of intervals between consecutive samples where both ends pass (sample resolution);
 * null when any sample is unknown, a UTC is invalid, or fewer than two samples give no duration.
 */
export function evaluateAntennaWindow(data: SiteDateData, hardware: AntennaHardware, yawDeg: number): AntennaWindowResult {
  const unresolved = [GEOMETRY_ONLY_NOTE];
  if (data.purpose === 'synthetic-test') unresolved.push('Synthetic test data; not a mission result.');
  const localOnly = data.earthHorizon.horizonCoverage === 'local-only';
  if (localOnly) unresolved.push(LOCAL_ONLY_NOTE);
  if (data.samples.some(s => s.ephemerisQuality === 'approximate')) unresolved.push('Approximate ephemeris (not JPL-verified) in this window.');

  if (hardware.identity === 'hypothetical') unresolved.push('Hypothetical antenna parameters; not a real lander specification.');

  const timed = data.samples.map(s => ({ s, ms: utcMs(s.utc) }));
  const utcValid = timed.every(t => t.ms !== null);
  if (!utcValid) unresolved.push('Some sample UTC strings are not valid ISO 8601 UTC ending in Z; contact hours not measured.');
  const sorted = utcValid ? [...timed].sort((a, b) => a.ms! - b.ms!) : timed;
  const duplicates = utcValid && sorted.some((t, i) => i > 0 && t.ms === sorted[i - 1].ms);
  if (duplicates) unresolved.push('Duplicate sample UTC timestamps; contact hours not measured.');
  const ordered: EphemerisSample[] = sorted.map(t => t.s);

  const untraceable = data.samples.filter(s => s.earth !== null && s.sourceId === null).map(s => s.utc);
  if (untraceable.length) unresolved.push(`Ephemeris samples with no source id (untraceable): ${untraceable.join(', ')}.`);
  if (data.earthHorizon.horizonCoverage !== 'missing' && data.earthHorizon.sourceId === null) {
    unresolved.push('Earth horizon has no source id (untraceable).');
  }

  const samples = ordered.map(s => evaluateEarthPointing(s, data.earthHorizon, hardware, yawDeg));
  const status = worst(samples.map(s => s.status));
  const contactHours = utcValid && !duplicates ? measureContactHours(samples) : null;

  let reason: string;
  if (samples.length === 0) {
    reason = 'No ephemeris samples in this window; antenna pointing unknown.';
  } else {
    const passed = samples.filter(s => s.status === 'pass').length;
    reason = `${passed} of ${samples.length} samples have geometric Earth pointing at yaw ${yawDeg} deg`;
    reason += contactHours === null ? '.' : ` (${round(contactHours)} h at sample resolution).`;
    const firstFail = samples.find(s => s.status === 'fail');
    const firstUnknown = samples.find(s => s.status === 'unknown');
    if (firstFail) reason += ` First failure at ${firstFail.utc}: ${firstFail.reason}`;
    else if (firstUnknown) reason += ` First unknown at ${firstUnknown.utc}: ${firstUnknown.reason}`;
    if (status === 'pass' && localOnly) reason += ' Local terrain only; distant obstructions unmodeled.';
    if (status === 'pass' && data.samples.some(s => s.ephemerisQuality === 'approximate')) reason += ' Approximate ephemeris (not JPL-verified).';
  }

  const sourceIds = [...new Set([...data.samples.map(s => s.sourceId), data.earthHorizon.sourceId, hardware.specificationSourceId ?? null]
    .filter((id): id is string => id !== null))];
  const known = new Set(data.provenance.map(p => p.id));
  for (const id of sourceIds) if (!known.has(id)) unresolved.push(`Source id "${id}" has no provenance record.`);

  return { antenna: { status, reason, sourceIds }, contactHours, unresolved, samples };
}

function measureContactHours(samples: EarthPointingResult[]): number | null {
  if (samples.length < 2 || samples.some(s => s.status === 'unknown')) return null;
  let ms = 0;
  for (let i = 1; i < samples.length; i++) {
    if (samples[i - 1].status === 'pass' && samples[i].status === 'pass') {
      ms += Date.parse(samples[i].utc) - Date.parse(samples[i - 1].utc);
    }
  }
  return ms / 3_600_000;
}

function worst(statuses: Status[]): Status {
  if (statuses.length === 0) return 'unknown';
  if (statuses.includes('fail')) return 'fail';
  if (statuses.includes('unknown')) return 'unknown';
  return 'pass';
}

const round = (x: number) => Math.round(x * 100) / 100;
