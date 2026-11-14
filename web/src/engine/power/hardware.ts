import type { HardwareConfig, Status } from '../../contracts';
import { normalize } from './vectors';

/** The HardwareConfig fields this engine reads; a full HardwareConfig is accepted. */
export type PowerHardware = Pick<HardwareConfig,
  | 'panels' | 'peakSolarPowerW' | 'totalActivePvAreaM2' | 'panelHeightM' | 'constantLoadW'
  | 'batteryCapacityWh' | 'batteryInitialWh' | 'minReserveWh' | 'chargeEfficiency' | 'dischargeEfficiency'>
  & Partial<Pick<HardwareConfig, 'name' | 'identity' | 'specificationSourceId'>>;

export type BatteryParams = Pick<HardwareConfig,
  'batteryCapacityWh' | 'batteryInitialWh' | 'minReserveWh' | 'constantLoadW' | 'chargeEfficiency' | 'dischargeEfficiency'>;

const AREA_SUM_TOL = 1e-6;
const finite = (...xs: number[]) => xs.every(Number.isFinite);

/** First problem with the array and load parameters, or null when they are usable. */
export function solarHardwareProblem(h: PowerHardware): string | null {
  if (h.panels.length === 0) return 'no panels configured';
  for (const p of h.panels) {
    if (!(Number.isFinite(p.areaFraction) && p.areaFraction >= 0)) return `panel "${p.name}" area fraction ${p.areaFraction} must be finite and >= 0`;
    if (!normalize(p.normalBodyRFU)) return `panel "${p.name}" normal must be a finite non-zero vector`;
    if (p.mode === 'tracked' && p.maxTrackingAngleDeg !== undefined
      && !(p.maxTrackingAngleDeg >= 0 && p.maxTrackingAngleDeg <= 180)) {
      return `panel "${p.name}" tracking limit ${p.maxTrackingAngleDeg} deg must be in [0, 180]`;
    }
  }
  const sum = h.panels.reduce((s, p) => s + p.areaFraction, 0);
  if (Math.abs(sum - 1) > AREA_SUM_TOL) return `panel area fractions sum to ${sum}, not 1`;
  if (!(Number.isFinite(h.totalActivePvAreaM2) && h.totalActivePvAreaM2 > 0)) return `total active PV area ${h.totalActivePvAreaM2} m2 must be > 0`;
  if (!(Number.isFinite(h.peakSolarPowerW) && h.peakSolarPowerW >= 0)) return `peak solar power ${h.peakSolarPowerW} W must be >= 0`;
  if (!(Number.isFinite(h.constantLoadW) && h.constantLoadW >= 0)) return `constant load ${h.constantLoadW} W must be >= 0`;
  if (!(Number.isFinite(h.panelHeightM) && h.panelHeightM >= 0)) return `panel height ${h.panelHeightM} m must be >= 0`;
  return null;
}

/** First problem with the battery parameters, or null when they are usable. */
export function batteryProblem(b: BatteryParams): string | null {
  const { batteryCapacityWh: cap, batteryInitialWh: init, minReserveWh: reserve } = b;
  if (!finite(cap, init, reserve, b.constantLoadW, b.chargeEfficiency, b.dischargeEfficiency)) return 'battery parameters must be finite';
  if (!(cap > 0)) return `battery capacity ${cap} Wh must be > 0`;
  if (!(init >= 0 && init <= cap)) return `initial energy ${init} Wh must be within [0, ${cap}]`;
  if (!(reserve >= 0 && reserve <= cap)) return `minimum reserve ${reserve} Wh must be within [0, ${cap}]`;
  if (!(b.constantLoadW >= 0)) return `constant load ${b.constantLoadW} W must be >= 0`;
  if (!(b.chargeEfficiency > 0 && b.chargeEfficiency <= 1)) return `charge efficiency ${b.chargeEfficiency} must be in (0, 1]`;
  if (!(b.dischargeEfficiency > 0 && b.dischargeEfficiency <= 1)) return `discharge efficiency ${b.dischargeEfficiency} must be in (0, 1]`;
  return null;
}

/**
 * Hardware comparisons are only fair at equal total active PV area (AGENTS.md).
 * Returns 'fail' with the offending names when areas differ.
 */
export function checkEqualPvArea(configs: readonly Pick<PowerHardware, 'totalActivePvAreaM2' | 'name'>[]): { status: Status; reason: string } {
  if (configs.length < 2) return { status: 'unknown', reason: 'Need at least two hardware configurations to compare PV area.' };
  const ref = configs[0].totalActivePvAreaM2;
  const label = (c: Pick<PowerHardware, 'totalActivePvAreaM2' | 'name'>, i: number) => `${c.name ?? `config ${i}`} (${c.totalActivePvAreaM2} m2)`;
  const off = configs.filter(c => !(Math.abs(c.totalActivePvAreaM2 - ref) <= 1e-9 * Math.max(1, Math.abs(ref))));
  if (off.length === 0) return { status: 'pass', reason: `All ${configs.length} configurations have ${ref} m2 total active PV area.` };
  return { status: 'fail', reason: `Unequal total active PV area: ${configs.map(label).join(', ')}. Compare only at equal area.` };
}
