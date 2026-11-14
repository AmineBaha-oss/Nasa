import { describe, it, expect } from 'vitest';
import fixture from '../../../tests/fixtures/synthetic-site-date.json';
import type { SiteDateData } from '../contracts';
import { hasFullCoverageEvidence } from './quality';
const data = () => structuredClone(fixture) as SiteDateData;
describe('science evidence gate (synthetic unit tests only)', () => {
  it('rejects synthetic inputs', () => expect(hasFullCoverageEvidence(data())).toBe(false));
  it('does not equate verified astronomy with complete terrain', () => {
    const d = data(); d.purpose = 'research'; d.samples[0].ephemerisQuality = 'jpl-verified';
    expect(hasFullCoverageEvidence(d)).toBe(false);
  });
  it('rejects a null horizon bin even when metadata says validated', () => {
    const d = data(); d.purpose = 'research'; d.samples[0].ephemerisQuality = 'jpl-verified';
    d.sunHorizon.horizonCoverage = d.earthHorizon.horizonCoverage = 'far-field-validated';
    expect(hasFullCoverageEvidence(d)).toBe(false);
  });
  it('accepts complete evidence flags but never produces a pass verdict', () => {
    const d = data(); d.purpose = 'research'; d.samples[0].ephemerisQuality = 'jpl-verified';
    d.sunHorizon.horizonCoverage = d.earthHorizon.horizonCoverage = 'far-field-validated';
    d.earthHorizon.anglesDeg = [0,0,0,0];
    expect(hasFullCoverageEvidence(d)).toBe(true);
    d.samples = []; expect(hasFullCoverageEvidence(d)).toBe(false);
  });
});
