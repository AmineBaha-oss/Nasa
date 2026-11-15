import type { HardwareConfig, SiteDateData, Status } from '../contracts';
import { evaluateEarthPointing, type EarthPointingResult } from '../engine/comms';
import {
  azElToEnu, evaluatePowerWindow, evaluateSolarSample, panelIncidence, panelPointingEnu, solarHardwareProblem,
  type Interval, type Vec3,
} from '../engine/power';

/**
 * Engine values for the 3D scene and the HUD, so both always show the same numbers.
 * Nothing here decides a status; it only collects engine output per sample.
 */
export interface TrackPoint { utc: string; azDeg: number | null; elDeg: number | null; visible: Status }

export interface WindowTracks {
  sun: TrackPoint[];
  earth: TrackPoint[];
  /** Battery energy bounds aligned with data.samples (matched by UTC); null where the engine has none. */
  batteryWh: (Interval | null)[];
}

export interface PanelReadout { name: string; incidence: number | null; pointingEnu: Vec3 | null; clamped: boolean }

export interface SampleReadout {
  utc: string;
  sun: { visible: Status; fraction: Interval; azDeg: number | null; elDeg: number | null };
  powerW: Interval;
  panels: PanelReadout[];
  earth: EarthPointingResult;
  batteryWh: Interval | null;
}

export function windowTracks(data: SiteDateData, hardware: HardwareConfig, yawDeg: number): WindowTracks {
  const byUtc = new Map(evaluatePowerWindow(data, hardware, yawDeg).batterySeries.map(b => [b.utc, b.energyWh]));
  return {
    sun: data.samples.map(s => ({
      utc: s.utc, azDeg: s.ephemerisQuality === 'missing' ? null : s.sun?.azDeg ?? null, elDeg: s.ephemerisQuality === 'missing' ? null : s.sun?.elDeg ?? null,
      visible: evaluateSolarSample(s, data.sunHorizon, hardware, yawDeg).sunlit,
    })),
    earth: data.samples.map(s => ({
      utc: s.utc, azDeg: s.ephemerisQuality === 'missing' ? null : s.earth?.azDeg ?? null, elDeg: s.ephemerisQuality === 'missing' ? null : s.earth?.elDeg ?? null,
      visible: evaluateEarthPointing(s, data.earthHorizon, hardware, yawDeg).earthVisible,
    })),
    batteryWh: data.samples.map(s => byUtc.get(s.utc) ?? null),
  };
}

export function sampleReadout(data: SiteDateData, hardware: HardwareConfig, yawDeg: number, sampleIndex: number,
  tracks?: WindowTracks): SampleReadout | null {
  const sample = data.samples[sampleIndex];
  if (!sample) return null;
  const solar = evaluateSolarSample(sample, data.sunHorizon, hardware, yawDeg);
  const hardwareOk = solarHardwareProblem(hardware) === null;
  const sun = sample.ephemerisQuality !== 'missing' && sample.sun && Number.isFinite(sample.sun.azDeg) && Number.isFinite(sample.sun.elDeg)
    ? azElToEnu(sample.sun.azDeg, sample.sun.elDeg) : null;
  const panels = hardware.panels.map(p => {
    const pointing = panelPointingEnu(p, sun ?? [0, 0, 0], yawDeg);
    return {
      name: p.name,
      incidence: sun && hardwareOk ? panelIncidence(p, sun, yawDeg) : null,
      pointingEnu: pointing?.normalEnu ?? null,
      clamped: pointing?.clamped ?? false,
    };
  });
  const peak = Number.isFinite(hardware.peakSolarPowerW) ? Math.max(0, hardware.peakSolarPowerW) : 0;
  return {
    utc: sample.utc,
    sun: { visible: solar.sunlit, fraction: solar.visibleFraction, azDeg: sun ? sample.sun!.azDeg : null, elDeg: sun ? sample.sun!.elDeg : null },
    powerW: hardwareOk ? solar.powerW : { low: 0, high: peak },
    panels,
    earth: evaluateEarthPointing(sample, data.earthHorizon, hardware, yawDeg),
    batteryWh: (tracks ?? windowTracks(data, hardware, yawDeg)).batteryWh[sampleIndex] ?? null,
  };
}
