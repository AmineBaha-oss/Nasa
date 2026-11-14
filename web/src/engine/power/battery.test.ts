// SYNTHETIC UNIT TESTS ONLY. Battery values are hypothetical test inputs, not a real lander.
import { describe, expect, it } from 'vitest';
import type { BatteryParams } from './hardware';
import { simulateBattery, type PowerPoint } from './battery';

const battery = (over: Partial<BatteryParams> = {}): BatteryParams => ({
  batteryCapacityWh: 1000, batteryInitialWh: 500, minReserveWh: 200,
  constantLoadW: 0, chargeEfficiency: 1, dischargeEfficiency: 1, ...over,
});
/** Constant power over evenly spaced points spanning `hours`. */
const constant = (powerW: number, hours: number, steps = 1): PowerPoint[] =>
  Array.from({ length: steps + 1 }, (_, i) => ({ hours: (hours * i) / steps, powerW }));

describe('simulateBattery', () => {
  it('no input and no load keeps the initial energy', () => {
    const r = simulateBattery(constant(0, 10), battery());
    expect(r.energyWh).toEqual([500, 500]);
    expect(r.firstBreachIndex).toBeNull();
  });

  it('constant surplus charges at chargeEfficiency and caps at capacity', () => {
    const r = simulateBattery(constant(100, 4, 4), battery({ constantLoadW: 20, chargeEfficiency: 0.9 }));
    // 80 W surplus * 0.9 = 72 Wh per hour.
    expect(r.energyWh.slice(0, 4)).toEqual([500, 572, 644, 716]);
    const capped = simulateBattery(constant(100, 20, 20), battery({ constantLoadW: 20, chargeEfficiency: 0.9 }));
    expect(Math.max(...capped.energyWh)).toBe(1000);
    expect(capped.spilledWh).toBeGreaterThan(0);
  });

  it('constant deficit drains at load / dischargeEfficiency', () => {
    const r = simulateBattery(constant(0, 2, 2), battery({ constantLoadW: 80, dischargeEfficiency: 0.8 }));
    expect(r.energyWh).toEqual([500, 400, 300]);
  });

  it('detects a reserve breach and keeps the unclamped minimum before clipping at zero', () => {
    const r = simulateBattery(constant(0, 10, 10), battery({ constantLoadW: 100 }));
    expect(r.firstBreachIndex).toBe(4); // 500 -> 400 -> 300 -> 200 -> 100
    expect(r.minimumUnclampedWh).toBe(-100);
    expect(r.minimumWh).toBe(0);
    expect(Math.min(...r.energyWh)).toBe(0);
    expect(r.shortfallWh).toBe(500);
    expect(r.recoveredIndex).toBeNull();
  });

  it('a single large step still detects the breach (no clipping before the reserve check)', () => {
    const r = simulateBattery(constant(0, 10), battery({ constantLoadW: 100 }));
    expect(r.firstBreachIndex).toBe(1);
    expect(r.minimumUnclampedWh).toBe(-500);
  });

  it('reports recovery above the reserve after a breach', () => {
    const points: PowerPoint[] = [
      { hours: 0, powerW: 0 }, { hours: 4, powerW: 0 }, { hours: 4.000001, powerW: 300 }, { hours: 8, powerW: 300 },
    ];
    const r = simulateBattery(points, battery({ constantLoadW: 100 }));
    expect(r.firstBreachIndex).toBe(1);
    expect(r.recoveredIndex).toBe(3);
  });

  it('with a zero reserve, draining past empty is still a breach', () => {
    const r = simulateBattery(constant(0, 10), battery({ minReserveWh: 0, constantLoadW: 100 }));
    expect(r.energyWh[1]).toBe(0);
    expect(r.firstBreachIndex).toBe(1);
  });

  it('an initial energy below the reserve is a breach at index 0', () => {
    const r = simulateBattery(constant(0, 1), battery({ batteryInitialWh: 100 }));
    expect(r.firstBreachIndex).toBe(0);
  });

  it('exactly reaching the reserve is not a breach', () => {
    const r = simulateBattery(constant(0, 3), battery({ constantLoadW: 100 }));
    expect(r.energyWh[1]).toBe(200);
    expect(r.firstBreachIndex).toBeNull();
  });

  it('converges with timestep for constant power without clamping', () => {
    const b = battery({ constantLoadW: 30, chargeEfficiency: 0.95, dischargeEfficiency: 0.9 });
    const coarse = simulateBattery(constant(10, 6, 1), b).endWh;
    const fine = simulateBattery(constant(10, 6, 60), b).endWh;
    expect(fine).toBeCloseTo(coarse, 9);
  });

  it('integrates a linear power ramp exactly with the trapezoidal rule', () => {
    const ramp: PowerPoint[] = [{ hours: 0, powerW: 0 }, { hours: 2, powerW: 100 }];
    expect(simulateBattery(ramp, battery()).endWh).toBe(600);
  });

  it('more input power never lowers stored energy (monotone, so power bounds give energy bounds)', () => {
    const b = battery({ constantLoadW: 60, chargeEfficiency: 0.9, dischargeEfficiency: 0.9 });
    const low = simulateBattery([0, 1, 2, 3].map(h => ({ hours: h, powerW: [0, 50, 90, 10][h] })), b);
    const high = simulateBattery([0, 1, 2, 3].map(h => ({ hours: h, powerW: [20, 80, 120, 40][h] })), b);
    low.energyWh.forEach((e, i) => expect(high.energyWh[i]).toBeGreaterThanOrEqual(e));
  });

  it('a single point has no duration and returns the initial state', () => {
    const r = simulateBattery([{ hours: 0, powerW: 0 }], battery());
    expect(r.energyWh).toEqual([500]);
    expect(r.endWh).toBe(500);
  });
});
