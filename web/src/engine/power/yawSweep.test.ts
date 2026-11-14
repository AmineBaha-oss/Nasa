// SYNTHETIC UNIT TESTS ONLY. Values are hypothetical test inputs, not a real lander, site or date.
import { describe, expect, it } from 'vitest';
import fixture from '../../../../tests/fixtures/synthetic-site-date.json';
import type { EphemerisSample, Panel, SiteDateData } from '../../contracts';
import type { PowerHardware } from './hardware';
import { sweepPowerYaw } from './yawSweep';

const hw = (panels: Panel[]): PowerHardware => ({
  panels, peakSolarPowerW: 200, totalActivePvAreaM2: 2, panelHeightM: 2, constantLoadW: 80,
  batteryCapacityWh: 1000, batteryInitialWh: 800, minReserveWh: 200, chargeEfficiency: 0.95, dischargeEfficiency: 0.95,
});
const forward: Panel = { name: 'forward', areaFraction: 1, normalBodyRFU: [0, 1, 0], mode: 'fixed' };
const ideal: Panel = { name: 'ideal', areaFraction: 1, normalBodyRFU: [0, 1, 0], mode: 'tracked' };

/** Four hourly samples with a fixed Sun azimuth at 5 deg elevation over a flat 0 deg skyline. */
const window = (sunAzDeg: number): SiteDateData => {
  const d = structuredClone(fixture) as SiteDateData;
  d.sunHorizon.anglesDeg = [0, 0, 0, 0];
  d.samples = [0, 1, 2, 3].map((h): EphemerisSample => ({
    utc: `2027-10-01T0${h}:00:00Z`, sun: { azDeg: sunAzDeg, elDeg: 5 }, earth: null, ephemerisQuality: 'approximate', sourceId: 'synthetic',
  }));
  return d;
};

describe('sweepPowerYaw', () => {
  it('samples yaw from 0 up to (not including) 360 at the requested step', () => {
    const r = sweepPowerYaw(window(0), hw([forward]), 90);
    expect(r.entries.map(e => e.yawDeg)).toEqual([0, 90, 180, 270]);
  });

  it('an ideal tracker is yaw-insensitive: heading legitimately does not matter', () => {
    const r = sweepPowerYaw(window(0), hw([ideal]), 15);
    expect(r.yawSensitive).toBe(false);
    expect(new Set(r.entries.map(e => e.solar)).size).toBe(1);
  });

  it('an ideal tracker stays yaw-insensitive when the skyline between bins is unresolved', () => {
    const d = window(45);
    d.sunHorizon.anglesDeg = [0, 10, 0, 0];
    const r = sweepPowerYaw(d, hw([ideal]), 15);
    expect(r.entries[0].generatedWh!.low).toBeLessThan(r.entries[0].generatedWh!.high);
    expect(r.yawSensitive).toBe(false);
  });

  it('a fixed panel under a terrain-blocked Sun is yaw-insensitive (zero output at every heading)', () => {
    const d = window(0);
    d.sunHorizon.anglesDeg = [10, 10, 10, 10];
    expect(sweepPowerYaw(d, hw([forward]), 90).yawSensitive).toBe(false);
  });

  it('a fixed panel with an unresolved skyline still counts as yaw-sensitive when the Sun is certainly partly visible', () => {
    const d = window(45);
    d.sunHorizon.anglesDeg = [0, 4, 0, 0];
    const r = sweepPowerYaw(d, hw([forward]), 90);
    expect(r.yawSensitive).toBe(true);
  });

  it('a single fixed panel is yaw-sensitive and only passes facing the Sun', () => {
    const r = sweepPowerYaw(window(0), hw([forward]), 30);
    expect(r.yawSensitive).toBe(true);
    expect(r.solarPassYawsDeg).toContain(0);
    expect(r.solarPassYawsDeg).not.toContain(180);
  });

  it('the same heading at two dates with different Sun azimuths changes the result', () => {
    const a = sweepPowerYaw(window(0), hw([forward]), 90);
    const b = sweepPowerYaw(window(180), hw([forward]), 90);
    expect(a.entries[0].solar).toBe('pass');
    expect(b.entries[0].solar).toBe('fail');
    expect(b.solarPassYawsDeg).toContain(180);
  });

  it('rejects a non-positive or non-finite step', () => {
    expect(() => sweepPowerYaw(window(0), hw([forward]), 0)).toThrow(/step/);
    expect(() => sweepPowerYaw(window(0), hw([forward]), Number.NaN)).toThrow(/step/);
  });

  it('yaw sensitivity is unknown when generation is undetermined', () => {
    const d = window(0);
    d.samples.forEach(s => { s.sun = null; });
    expect(sweepPowerYaw(d, hw([forward]), 90).yawSensitive).toBeNull();
  });
});
