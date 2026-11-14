import type { SiteDateData } from '../contracts';
// Necessary evidence gate only; this never declares a mission pass.
export function hasFullCoverageEvidence(data: SiteDateData): boolean {
  const sources = new Set(data.provenance.map(source => source.id));
  return data.purpose === 'research' && data.samples.length > 0 &&
    data.samples.every(sample => sample.ephemerisQuality === 'jpl-verified' &&
      sample.sun !== null && sample.earth !== null && sample.sourceId !== null && sources.has(sample.sourceId)) &&
    [data.sunHorizon, data.earthHorizon].every(profile =>
      profile.horizonCoverage === 'far-field-validated' && profile.extentKm > 0 &&
      profile.sourceId !== null && sources.has(profile.sourceId) &&
      profile.azimuthStepDeg > 0 && profile.anglesDeg.length === 360 / profile.azimuthStepDeg &&
      profile.anglesDeg.every(angle => angle !== null && Number.isFinite(angle)));
}
