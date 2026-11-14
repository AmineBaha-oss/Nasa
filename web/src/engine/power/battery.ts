import type { BatteryParams } from './hardware';

/** Array output at a time offset from the window start. Points must be in ascending time. */
export interface PowerPoint { hours: number; powerW: number }

export interface BatteryRun {
  /** Stored energy at each point after clamping to [0, capacity], Wh. */
  energyWh: number[];
  /** Lowest clamped stored energy, Wh. */
  minimumWh: number;
  /** Lowest value of any step before clamping; negative means the load could not be served. */
  minimumUnclampedWh: number;
  /** First point whose pre-clamp energy is below the reserve; null when the reserve always holds. */
  firstBreachIndex: number | null;
  /** First point after the breach with stored energy back at or above the reserve. */
  recoveredIndex: number | null;
  endWh: number;
  /** Surplus discarded because the battery was full, Wh (after charge efficiency). */
  spilledWh: number;
  /** Battery energy the load needed but the empty battery could not supply, Wh. */
  shortfallWh: number;
}

/**
 * Direct-supply bus with a battery buffer. Over each interval the array power is the trapezoidal
 * average of its end points; the constant load is served directly first.
 *   surplus  (P > load): E += (P - load) * chargeEfficiency * dt
 *   deficit  (P < load): E -= (load - P) / dischargeEfficiency * dt
 * Net power is constant within an interval, so checking the reserve at interval ends is exact for
 * this model. The reserve test uses the pre-clamp value, so clipping at zero never hides a breach.
 * Parameters must already have passed batteryProblem.
 */
export function simulateBattery(points: readonly PowerPoint[], b: BatteryParams): BatteryRun {
  const cap = b.batteryCapacityWh;
  let e = b.batteryInitialWh;
  const energyWh = [e];
  let minimumUnclampedWh = e;
  let firstBreachIndex: number | null = e < b.minReserveWh ? 0 : null;
  let recoveredIndex: number | null = null;
  let spilledWh = 0;
  let shortfallWh = 0;

  for (let i = 1; i < points.length; i++) {
    const dt = points[i].hours - points[i - 1].hours;
    const net = (points[i - 1].powerW + points[i].powerW) / 2 - b.constantLoadW;
    const raw = e + (net >= 0 ? net * b.chargeEfficiency : net / b.dischargeEfficiency) * dt;
    minimumUnclampedWh = Math.min(minimumUnclampedWh, raw);
    if (raw > cap) spilledWh += raw - cap;
    if (raw < 0) shortfallWh -= raw;
    e = Math.min(cap, Math.max(0, raw));
    energyWh.push(e);
    if (firstBreachIndex === null && raw < b.minReserveWh) firstBreachIndex = i;
    else if (firstBreachIndex !== null && recoveredIndex === null && i > firstBreachIndex && e >= b.minReserveWh) recoveredIndex = i;
  }

  return { energyWh, minimumWh: Math.min(...energyWh), minimumUnclampedWh, firstBreachIndex, recoveredIndex, endWh: e, spilledWh, shortfallWh };
}
