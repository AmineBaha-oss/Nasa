// SYNTHETIC UNIT TESTS ONLY. Presets are illustrative, not NASA or real lander specifications.
import { describe, expect, it } from 'vitest';
import type { Panel } from '../../contracts';
import { batteryProblem, checkEqualPvArea, solarHardwareProblem, type PowerHardware } from './hardware';
import { ILLUSTRATIVE_POWER_PRESETS } from './presets';

describe('ILLUSTRATIVE_POWER_PRESETS', () => {
  it('are labelled hypothetical and illustrative, with no specification source', () => {
    expect(ILLUSTRATIVE_POWER_PRESETS.length).toBeGreaterThanOrEqual(3);
    for (const p of ILLUSTRATIVE_POWER_PRESETS) {
      expect(p.identity).toBe('hypothetical');
      expect(p.specificationSourceId).toBeNull();
      expect(p.name).toMatch(/illustrative/i);
    }
  });

  it('are valid inputs for the engine', () => {
    for (const p of ILLUSTRATIVE_POWER_PRESETS) {
      expect(solarHardwareProblem(p)).toBeNull();
      expect(batteryProblem(p)).toBeNull();
    }
  });

  it('share the same total active PV area and peak power, so comparisons are fair', () => {
    expect(checkEqualPvArea(ILLUSTRATIVE_POWER_PRESETS).status).toBe('pass');
    expect(new Set(ILLUSTRATIVE_POWER_PRESETS.map(p => p.peakSolarPowerW)).size).toBe(1);
  });

  it('label the unconstrained tracker as an ideal upper bound', () => {
    const ideal = ILLUSTRATIVE_POWER_PRESETS.filter(p => p.panels.some(panel => panel.mode === 'tracked' && panel.maxTrackingAngleDeg === undefined));
    expect(ideal.length).toBe(1);
    expect(ideal[0].name).toMatch(/ideal/i);
    expect(ideal[0].name).toMatch(/upper bound/i);
  });
});

describe('hardware validation', () => {
  const panel: Panel = { name: 'p', areaFraction: 1, normalBodyRFU: [0, 1, 0], mode: 'fixed' };
  const base = ILLUSTRATIVE_POWER_PRESETS[0];
  const with_ = (over: Partial<PowerHardware>): PowerHardware => ({ ...base, ...over });

  it.each([
    ['no panels', with_({ panels: [] })],
    ['area fractions sum to 0.5', with_({ panels: [{ ...panel, areaFraction: 0.5 }] })],
    ['negative area fraction', with_({ panels: [{ ...panel, areaFraction: -1 }, { ...panel, areaFraction: 2 }] })],
    ['zero normal', with_({ panels: [{ ...panel, normalBodyRFU: [0, 0, 0] }] })],
    ['tracking limit above 180', with_({ panels: [{ ...panel, mode: 'tracked', maxTrackingAngleDeg: 200 }] })],
    ['zero PV area', with_({ totalActivePvAreaM2: 0 })],
    ['negative load', with_({ constantLoadW: -1 })],
  ])('solarHardwareProblem rejects %s', (_label, h) => expect(solarHardwareProblem(h)).not.toBeNull());

  it.each([
    ['initial above capacity', with_({ batteryInitialWh: base.batteryCapacityWh + 1 })],
    ['reserve above capacity', with_({ minReserveWh: base.batteryCapacityWh + 1 })],
    ['zero charge efficiency', with_({ chargeEfficiency: 0 })],
    ['discharge efficiency above 1', with_({ dischargeEfficiency: 1.1 })],
    ['zero capacity', with_({ batteryCapacityWh: 0, batteryInitialWh: 0, minReserveWh: 0 })],
  ])('batteryProblem rejects %s', (_label, h) => expect(batteryProblem(h)).not.toBeNull());

  it('checkEqualPvArea fails on unequal area and names both configurations', () => {
    const r = checkEqualPvArea([{ name: 'A', totalActivePvAreaM2: 2 }, { name: 'B', totalActivePvAreaM2: 3 }]);
    expect(r.status).toBe('fail');
    expect(r.reason).toMatch(/A \(2 m2\).*B \(3 m2\)/);
  });

  it('checkEqualPvArea needs two configurations', () => {
    expect(checkEqualPvArea([{ name: 'A', totalActivePvAreaM2: 2 }]).status).toBe('unknown');
  });
});
