import type { SiteDateData, Status } from '../../contracts';
import type { PowerHardware } from './hardware';
import { evaluatePowerWindow } from './powerWindow';
import type { Interval, SolarSampleResult } from './solar';

export interface YawSweepEntry {
  yawDeg: number;
  solar: Status;
  battery: Status;
  generatedWh: Interval | null;
  minimumBatteryWh: Interval | null;
}

export interface YawSweepResult {
  stepDeg: number;
  entries: YawSweepEntry[];
  /**
   * Whether array output depends on heading at some sample of this window.
   * true: at a sample with the Sun certainly (partly) visible, incidence differs between headings.
   * false: at every sample the Sun direction is known and incidence is heading-independent
   * (e.g. ideal trackers) or the Sun is certainly blocked. null: unresolved inputs leave it open.
   */
  yawSensitive: boolean | null;
  solarPassYawsDeg: number[];
  batteryPassYawsDeg: number[];
}

/**
 * Evaluate the power constraints at every heading from 0 up to 360 deg. Keeps only summaries, not
 * per-sample detail, so a full sweep stays small. No heading is ranked or preferred here.
 */
export function sweepPowerYaw(data: SiteDateData, hardware: PowerHardware, stepDeg = 5): YawSweepResult {
  if (!(Number.isFinite(stepDeg) && stepDeg > 0)) throw new Error(`yaw step ${stepDeg} must be a positive finite number of degrees`);
  const entries: YawSweepEntry[] = [];
  const incidence = new IncidenceSpread();
  for (let k = 0; k * stepDeg < 360; k++) {
    const yawDeg = k * stepDeg;
    const r = evaluatePowerWindow(data, hardware, yawDeg);
    incidence.add(r.samples);
    entries.push({ yawDeg, solar: r.solar.status, battery: r.battery.status, generatedWh: r.generatedWh, minimumBatteryWh: r.minimumBatteryWhBounds });
  }
  return {
    stepDeg,
    entries,
    yawSensitive: incidence.sensitivity(),
    solarPassYawsDeg: entries.filter(e => e.solar === 'pass').map(e => e.yawDeg),
    batteryPassYawsDeg: entries.filter(e => e.battery === 'pass').map(e => e.yawDeg),
  };
}

/**
 * Per-sample range of the incidence factor across headings. Visibility does not depend on heading,
 * so heading changes output exactly where incidence varies and some sunlight reaches the panels.
 */
class IncidenceSpread {
  private min: (number | null)[] = [];
  private max: (number | null)[] = [];
  private visible: SolarSampleResult['visibleFraction'][] = [];
  private evaluated = false;

  add(samples: SolarSampleResult[]): void {
    if (!this.evaluated) {
      this.evaluated = true;
      this.min = samples.map(s => s.incidence);
      this.max = samples.map(s => s.incidence);
      this.visible = samples.map(s => s.visibleFraction);
      return;
    }
    samples.forEach((s, i) => {
      const lo = this.min[i], hi = this.max[i];
      if (s.incidence === null || lo === null || hi === null) { this.min[i] = this.max[i] = null; return; }
      this.min[i] = Math.min(lo, s.incidence);
      this.max[i] = Math.max(hi, s.incidence);
    });
  }

  sensitivity(): boolean | null {
    if (!this.evaluated || this.min.length === 0) return null;
    let open = false;
    for (let i = 0; i < this.min.length; i++) {
      const lo = this.min[i], hi = this.max[i], f = this.visible[i];
      if (f.high === 0) continue;
      if (lo === null || hi === null) { open = true; continue; }
      if (hi - lo <= INCIDENCE_TOL) continue;
      if (f.low > 0) return true;
      open = true;
    }
    return open ? null : false;
  }
}

const INCIDENCE_TOL = 1e-12;
