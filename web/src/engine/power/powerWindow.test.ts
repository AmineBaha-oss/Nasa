// SYNTHETIC UNIT TESTS ONLY. Values are hypothetical test inputs, not a real lander, site or date.
import { describe, expect, it } from 'vitest';
import fixture from '../../../../tests/fixtures/synthetic-site-date.json';
import type { Direction, EphemerisSample, Panel, SiteDateData } from '../../contracts';
import type { PowerHardware } from './hardware';
import { evaluatePowerWindow, LOCAL_ONLY_NOTE, SOLAR_MODEL_NOTE } from './powerWindow';

const data = () => structuredClone(fixture) as SiteDateData;
const forwardPanel: Panel = { name: 'forward', areaFraction: 1, normalBodyRFU: [0, 1, 0], mode: 'fixed' };
const idealTracker: Panel = { name: 'ideal', areaFraction: 1, normalBodyRFU: [0, 1, 0], mode: 'tracked' };
const hw = (panels: Panel[] = [forwardPanel], over: Partial<PowerHardware> = {}): PowerHardware => ({
  name: 'test', identity: 'hypothetical', specificationSourceId: null,
  panels, peakSolarPowerW: 200, totalActivePvAreaM2: 2, panelHeightM: 2, constantLoadW: 80,
  batteryCapacityWh: 1000, batteryInitialWh: 800, minReserveWh: 200, chargeEfficiency: 0.95, dischargeEfficiency: 0.95, ...over,
});

/** Hourly samples with the given Sun directions (null = unknown) against a flat 0 deg skyline at 2 m. */
const hourly = (suns: (Direction | null)[]): SiteDateData => {
  const d = data();
  d.sunHorizon.anglesDeg = [0, 0, 0, 0];
  d.samples = suns.map((sun, h): EphemerisSample => ({
    utc: `2027-10-01T${String(h).padStart(2, '0')}:00:00Z`, sun, earth: null, ephemerisQuality: 'approximate', sourceId: 'synthetic',
  }));
  return d;
};
const north = (hours: number) => Array.from({ length: hours + 1 }, () => ({ azDeg: 0, elDeg: 5 }));

describe('evaluatePowerWindow', () => {
  it('the one-sample synthetic fixture has no duration: unknown, with every caveat', () => {
    const r = evaluatePowerWindow(data(), hw(), 0);
    expect(r.solar.status).toBe('unknown');
    expect(r.battery.status).toBe('unknown');
    expect(r.minimumBatteryWh).toBeNull();
    const notes = r.unresolved.join(' | ');
    expect(notes).toMatch(/synthetic/i);
    expect(notes).toContain(LOCAL_ONLY_NOTE);
    expect(notes).toMatch(/approximate/i);
    expect(notes).toMatch(/hypothetical power hardware/i);
    expect(notes).toContain(SOLAR_MODEL_NOTE);
  });

  it('panel facing the Sun covers the load: solar pass, exact energy, determinate battery minimum', () => {
    const r = evaluatePowerWindow(hourly(north(4)), hw(), 0);
    const p = 200 * Math.cos(5 * Math.PI / 180);
    expect(r.solar.status).toBe('pass');
    expect(r.generatedWh!.low).toBeCloseTo(p * 4, 9);
    expect(r.generatedWh!.high).toBeCloseTo(p * 4, 9);
    expect(r.loadWh).toBe(320);
    expect(r.battery.status).toBe('pass');
    expect(r.minimumBatteryWh).toBe(800);
    expect(r.batterySeries).toHaveLength(5);
  });

  it('the same data at yaw 180 points the panel away: solar fail', () => {
    const r = evaluatePowerWindow(hourly(north(4)), hw(), 180);
    expect(r.solar.status).toBe('fail');
    expect(r.generatedWh).toEqual({ low: 0, high: 0 });
    expect(r.solar.reason).toMatch(/yaw 180/);
  });

  it('a long dark window drains below the reserve: battery fail with the breach time', () => {
    const r = evaluatePowerWindow(hourly(north(10)), hw(), 180);
    expect(r.battery.status).toBe('fail');
    // 80 W / 0.95 drains 84.2 Wh per hour from 800 Wh; 200 Wh reserve breached at hour 8.
    expect(r.battery.reason).toMatch(/2027-10-01T08:00:00Z/);
    expect(r.minimumBatteryWh).toBe(0);
    expect(r.battery.reason).toMatch(/42\.11 Wh of load unserved/);
  });

  it('a short dark window stays above the reserve: battery pass despite zero generation', () => {
    expect(evaluatePowerWindow(hourly(north(6)), hw(), 180).battery.status).toBe('pass');
  });

  it('unknown Sun everywhere: decisive bounds still decide, others stay unknown', () => {
    const suns = Array.from({ length: 11 }, () => null);
    const r = evaluatePowerWindow(hourly(suns), hw(), 0);
    expect(r.solar.status).toBe('unknown');
    expect(r.battery.status).toBe('unknown');
    expect(r.minimumBatteryWh).toBeNull();
    expect(r.minimumBatteryWhBounds!.low).toBeLessThan(r.minimumBatteryWhBounds!.high);

    const overloaded = evaluatePowerWindow(hourly(suns), hw([forwardPanel], { constantLoadW: 250 }), 0);
    expect(overloaded.solar.status).toBe('fail');
    expect(overloaded.solar.reason).toMatch(/even at/i);
  });

  it('an unknown sample does not force unknown when the pessimistic bound already passes', () => {
    const suns: (Direction | null)[] = north(6);
    suns[3] = null;
    const r = evaluatePowerWindow(hourly(suns), hw(), 180);
    expect(r.battery.status).toBe('pass');
    expect(r.minimumBatteryWh).toBeNull();
  });

  it('a Sun horizon at the wrong observer height widens power to its bound', () => {
    const d = hourly(north(4));
    d.sunHorizon.observerHeightM = 3;
    const r = evaluatePowerWindow(d, hw(), 0);
    expect(r.generatedWh!.low).toBe(0);
    expect(r.solar.status).toBe('unknown');
    expect(r.samples[0].reason).toMatch(/height/i);
  });

  it('an ideal tracker is flagged as an upper bound', () => {
    const r = evaluatePowerWindow(hourly(north(2)), hw([idealTracker]), 0);
    expect(r.unresolved.join(' ')).toMatch(/ideal unconstrained tracker/i);
  });

  it.each([
    ['area fractions not summing to 1', hw([{ ...forwardPanel, areaFraction: 0.9 }])],
    ['zero panel normal', hw([{ ...forwardPanel, normalBodyRFU: [0, 0, 0] }])],
  ])('invalid array (%s) gives unknown solar and battery', (_label, h) => {
    const r = evaluatePowerWindow(hourly(north(2)), h, 0);
    expect(r.solar.status).toBe('unknown');
    expect(r.battery.status).toBe('unknown');
    expect(r.solar.reason).toMatch(/invalid/i);
  });

  it('invalid battery parameters leave solar evaluated but battery unknown', () => {
    const r = evaluatePowerWindow(hourly(north(2)), hw([forwardPanel], { batteryInitialWh: 2000 }), 0);
    expect(r.solar.status).toBe('pass');
    expect(r.battery.status).toBe('unknown');
  });

  it('non-finite yaw gives unknown', () => {
    expect(evaluatePowerWindow(hourly(north(2)), hw(), Number.NaN).solar.status).toBe('unknown');
  });

  it.each([
    ['missing Z', '2027-10-01T01:00:00'],
    ['February 30', '2027-02-30T00:00:00Z'],
    ['duplicate', '2027-10-01T00:00:00Z'],
  ])('a bad sample time (%s) makes the window unknown', (_label, utc) => {
    const d = hourly(north(2));
    d.samples[1].utc = utc;
    const r = evaluatePowerWindow(d, hw(), 0);
    expect(r.solar.status).toBe('unknown');
    expect(r.battery.status).toBe('unknown');
    expect(r.unresolved.join(' ')).toMatch(/UTC/);
  });

  it('orders samples by UTC before integrating', () => {
    const d = hourly(north(3));
    d.samples.reverse();
    const r = evaluatePowerWindow(d, hw(), 0);
    expect(r.samples.map(s => s.utc)).toEqual(['2027-10-01T00:00:00Z', '2027-10-01T01:00:00Z', '2027-10-01T02:00:00Z', '2027-10-01T03:00:00Z']);
    expect(r.solar.status).toBe('pass');
  });

  it('verified research data carries no local-only, approximate or synthetic caveat', () => {
    const d = hourly(north(2));
    d.purpose = 'research';
    d.sunHorizon.horizonCoverage = 'far-field-validated';
    d.samples.forEach(s => { s.ephemerisQuality = 'jpl-verified'; });
    const r = evaluatePowerWindow(d, hw([forwardPanel], { identity: 'documented', specificationSourceId: 'synthetic' }), 0);
    const text = [r.solar.reason, r.battery.reason, ...r.unresolved].join(' | ');
    expect(text).not.toMatch(/local terrain only|approximate|synthetic test|hypothetical/i);
    expect(r.unresolved).toContain(SOLAR_MODEL_NOTE);
  });

  it('a local-only pass says a pass may not survive distant terrain', () => {
    const r = evaluatePowerWindow(hourly(north(2)), hw(), 0);
    expect(r.solar.status).toBe('pass');
    expect(r.solar.reason).toMatch(/local terrain only/i);
  });

  it('traces source ids and flags ids without provenance', () => {
    const d = hourly(north(2));
    d.sunHorizon.sourceId = 'not-in-provenance';
    d.samples[1].sourceId = null;
    const r = evaluatePowerWindow(d, hw([forwardPanel], { specificationSourceId: 'hw-spec' }), 0);
    expect(r.solar.sourceIds).toEqual(expect.arrayContaining(['synthetic', 'not-in-provenance', 'hw-spec']));
    const notes = r.unresolved.join(' ');
    expect(notes).toMatch(/not-in-provenance/);
    expect(notes).toMatch(/2027-10-01T01:00:00Z/);
  });
});
