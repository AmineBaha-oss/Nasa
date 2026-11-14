// SYNTHETIC UNIT TESTS ONLY. Antenna values are hypothetical test inputs, not a real lander.
import { describe, it, expect } from 'vitest';
import fixture from '../../../../tests/fixtures/synthetic-site-date.json';
import type { EphemerisSample, HardwareConfig, SiteDateData } from '../../contracts';
import { evaluateAntennaWindow, GEOMETRY_ONLY_NOTE } from './index';

const data = () => structuredClone(fixture) as SiteDateData;
const fixedForward: Pick<HardwareConfig, 'antenna' | 'antennaHeightM'> = {
  antenna: { boresightBodyRFU: [0, 1, 0], beamHalfAngleDeg: 10 }, antennaHeightM: 3,
};

describe('evaluateAntennaWindow (window seam)', () => {
  it('passes the synthetic fixture at yaw 0 but carries every required caveat', () => {
    const r = evaluateAntennaWindow(data(), fixedForward, 0);
    expect(r.antenna.status).toBe('pass');
    expect(r.antenna.reason).toMatch(/local terrain only/i);
    expect(r.antenna.sourceIds).toEqual(['synthetic']);
    const notes = r.unresolved.join(' | ');
    expect(notes).toMatch(/synthetic/i);
    expect(notes).toMatch(/distant obstructions unmodeled/i);
    expect(notes).toMatch(/approximate/i);
    expect(notes).toMatch(/not a DSN contact/i);
    // One sample has no duration, so contact time cannot be measured.
    expect(r.contactHours).toBeNull();
  });

  // Hourly samples with Earth at elevation 5 deg and the given azimuths (null = missing direction).
  const hourly = (azimuths: (number | null)[]): SiteDateData => {
    const d = data();
    d.earthHorizon.anglesDeg = [0, 0, 0, 0];
    d.samples = azimuths.map((az, h): EphemerisSample => ({
      utc: `2027-10-01T${String(h).padStart(2, '0')}:00:00Z`,
      sun: null, earth: az === null ? null : { azDeg: az, elDeg: 5 },
      ephemerisQuality: 'approximate', sourceId: 'synthetic',
    }));
    return d;
  };

  describe('aggregation over samples', () => {
    it('continuous pointing over three hourly samples -> pass with 2 contact hours', () => {
      const r = evaluateAntennaWindow(hourly([0, 0, 0]), fixedForward, 0);
      expect(r.antenna.status).toBe('pass');
      expect(r.contactHours).toBe(2);
    });

    it('one sample out of beam -> window fail, contact hours count only pass-to-pass intervals', () => {
      const r = evaluateAntennaWindow(hourly([0, 0, 90]), fixedForward, 0);
      expect(r.antenna.status).toBe('fail');
      expect(r.contactHours).toBe(1);
      expect(r.antenna.reason).toMatch(/2027-10-01T02:00:00Z/);
    });

    it('an unknown sample makes the window unknown and contact hours unmeasurable', () => {
      const r = evaluateAntennaWindow(hourly([0, null, 0]), fixedForward, 0);
      expect(r.antenna.status).toBe('unknown');
      expect(r.contactHours).toBeNull();
    });

    it('a definite fail outranks an unknown sample', () => {
      expect(evaluateAntennaWindow(hourly([90, null, 0]), fixedForward, 0).antenna.status).toBe('fail');
    });

    it('no samples -> unknown', () => {
      const r = evaluateAntennaWindow(hourly([]), fixedForward, 0);
      expect(r.antenna.status).toBe('unknown');
      expect(r.contactHours).toBeNull();
      expect(r.antenna.reason).toMatch(/no ephemeris samples/i);
    });

    it('orders samples by UTC before measuring intervals', () => {
      const d = hourly([0, 0, 0]);
      d.samples.reverse();
      const r = evaluateAntennaWindow(d, fixedForward, 0);
      expect(r.contactHours).toBe(2);
      expect(r.samples.map(s => s.utc)).toEqual(['2027-10-01T00:00:00Z', '2027-10-01T01:00:00Z', '2027-10-01T02:00:00Z']);
    });

    it('a UTC string without a trailing Z makes contact hours unmeasurable', () => {
      const d = hourly([0, 0, 0]);
      d.samples[1].utc = '2027-10-01T01:00:00';
      const r = evaluateAntennaWindow(d, fixedForward, 0);
      expect(r.contactHours).toBeNull();
      expect(r.unresolved.join(' ')).toMatch(/UTC/);
    });

    it.each([
      ['February 30', '2027-02-30T00:00:00Z'],
      ['hour 24', '2027-10-01T24:00:00Z'],
    ])('a calendar-invalid UTC (%s) is rejected, not rolled over', (_label, bad) => {
      const d = hourly([0, 0, 0]);
      d.samples[1].utc = bad;
      const r = evaluateAntennaWindow(d, fixedForward, 0);
      expect(r.contactHours).toBeNull();
      expect(r.unresolved.join(' ')).toMatch(/UTC/);
    });

    it('duplicate UTC timestamps make contact hours unmeasurable (result must not depend on input order)', () => {
      const d = hourly([0, 90, 0]);
      d.samples[1].utc = d.samples[0].utc;
      const r = evaluateAntennaWindow(d, fixedForward, 0);
      expect(r.contactHours).toBeNull();
      expect(r.unresolved.join(' ')).toMatch(/duplicate/i);
    });

    it('the same data at a different yaw changes the result', () => {
      expect(evaluateAntennaWindow(hourly([0, 0, 0]), fixedForward, 180).antenna.status).toBe('fail');
    });
  });

  it('verified research data carries no local-only or approximate caveat', () => {
    const d = hourly([0, 0]);
    d.purpose = 'research';
    d.earthHorizon.horizonCoverage = 'far-field-validated';
    d.samples.forEach(s => { s.ephemerisQuality = 'jpl-verified'; });
    const r = evaluateAntennaWindow(d, fixedForward, 0);
    expect(r.antenna.status).toBe('pass');
    const text = [r.antenna.reason, ...r.unresolved].join(' | ');
    expect(text).not.toMatch(/local terrain only|distant obstructions/i);
    expect(text).not.toMatch(/approximate/i);
    expect(text).not.toMatch(/synthetic/i);
    expect(r.unresolved).toContain(GEOMETRY_ONLY_NOTE); // always present
  });

  it('a passing window with approximate ephemeris says so in its reason', () => {
    const r = evaluateAntennaWindow(hourly([0, 0]), fixedForward, 0);
    expect(r.antenna.status).toBe('pass');
    expect(r.antenna.reason).toMatch(/approximate ephemeris/i);
  });

  it('flags samples and horizons with no source id (untraceable data)', () => {
    const d = hourly([0, 0]);
    d.samples[1].sourceId = null;
    d.earthHorizon.sourceId = null;
    const notes = evaluateAntennaWindow(d, fixedForward, 0).unresolved.join(' ');
    expect(notes).toMatch(/2027-10-01T01:00:00Z/);
    expect(notes).toMatch(/Earth horizon has no source id/i);
  });

  it('includes the antenna specification source and flags hypothetical hardware', () => {
    const d = data();
    const documented = { ...fixedForward, identity: 'documented' as const, specificationSourceId: 'synthetic' };
    expect(evaluateAntennaWindow(d, documented, 0).antenna.sourceIds).toEqual(['synthetic']);
    const hypothetical = { ...fixedForward, identity: 'hypothetical' as const, specificationSourceId: null };
    expect(evaluateAntennaWindow(d, hypothetical, 0).unresolved.join(' ')).toMatch(/hypothetical antenna/i);
    const withSpec = { ...fixedForward, identity: 'documented' as const, specificationSourceId: 'hw-spec' };
    const r = evaluateAntennaWindow(d, withSpec, 0);
    expect(r.antenna.sourceIds).toContain('hw-spec');
    expect(r.unresolved.join(' ')).toMatch(/hw-spec/);
  });

  it('flags source ids that do not resolve to a provenance record', () => {
    const d = data();
    d.earthHorizon.sourceId = 'not-in-provenance';
    const r = evaluateAntennaWindow(d, fixedForward, 0);
    expect(r.antenna.sourceIds).toEqual(['synthetic', 'not-in-provenance']);
    expect(r.unresolved.join(' ')).toMatch(/not-in-provenance/);
  });
});
