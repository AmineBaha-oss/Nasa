import type { HardwareConfig, SiteDateData, Status } from '../contracts';
import { evaluateEarthPointing, type EarthPointingResult } from '../engine/comms';
import { evaluatePowerWindow, evaluateSolarSample, panelIncidence, type Interval } from '../engine/power';
import { azElToEnu, bodyToEnu, normalize, type Vec3 } from '../engine/power/vectors';

export interface SampleReadout {
  utc: string;
  sun: { visible: Status; fraction: Interval; elDeg: number | null };
  powerW: Interval;
  panels: { name: string; incidence: number | null; pointingEnu: Vec3 | null }[];
  earth: EarthPointingResult | null;
  batteryWh: Interval | null;
}

export interface TrackPoint {
  utc: string;
  azDeg: number | null;
  elDeg: number | null;
  aboveSkyline: boolean | null;
}

/** Per-sample numbers shared by the 3D scene and Person B's HUD. Engine output only. */
export function sampleReadout(data: SiteDateData, hardware: HardwareConfig, yawDeg: number, sampleIndex: number): SampleReadout {
  const i = Math.max(0, Math.min(sampleIndex, data.samples.length - 1));
  const sample = data.samples[i];
  const solar = evaluateSolarSample(sample, data.sunHorizon, hardware, yawDeg);
  const sunEnu = sample.sun ? azElToEnu(sample.sun.azDeg, sample.sun.elDeg) : null;
  const panels = hardware.panels.map(p => {
    const pointing = normalize(bodyToEnu(p.normalBodyRFU, yawDeg));
    const incidence = sunEnu && pointing ? panelIncidence(p, sunEnu, yawDeg) : null;
    return { name: p.name, incidence, pointingEnu: pointing };
  });
  const earth = evaluateEarthPointing(sample, data.earthHorizon, hardware, yawDeg);
  const power = evaluatePowerWindow(data, hardware, yawDeg);
  const battery = power.batterySeries.find(b => b.utc === sample.utc)?.energyWh ?? null;
  return {
    utc: sample.utc,
    sun: { visible: solar.sunlit, fraction: solar.visibleFraction, elDeg: sample.sun?.elDeg ?? null },
    powerW: solar.powerW,
    panels,
    earth,
    batteryWh: battery,
  };
}

function aboveSkyline(elDeg: number | null, azDeg: number | null, angles: (number | null)[], step: number): boolean | null {
  if (elDeg === null || azDeg === null || step <= 0 || angles.length === 0) return null;
  const i = Math.floor((((azDeg % 360) + 360) % 360) / step) % angles.length;
  const a = angles[i], b = angles[(i + 1) % angles.length];
  if (a === null || b === null) return null;
  return elDeg > Math.max(a, b);
}

/** Full-window tracks for the timeline strip and sky path. Battery matched by UTC. */
export function windowTracks(data: SiteDateData, hardware: HardwareConfig, yawDeg: number): {
  sun: TrackPoint[]; earth: TrackPoint[]; batteryWh: (Interval | null)[];
} {
  const power = evaluatePowerWindow(data, hardware, yawDeg);
  const byUtc = new Map(power.batterySeries.map(b => [b.utc, b.energyWh]));
  const sun = data.samples.map(s => ({
    utc: s.utc,
    azDeg: s.sun?.azDeg ?? null,
    elDeg: s.sun?.elDeg ?? null,
    aboveSkyline: aboveSkyline(s.sun?.elDeg ?? null, s.sun?.azDeg ?? null, data.sunHorizon.anglesDeg, data.sunHorizon.azimuthStepDeg),
  }));
  const earth = data.samples.map(s => ({
    utc: s.utc,
    azDeg: s.earth?.azDeg ?? null,
    elDeg: s.earth?.elDeg ?? null,
    aboveSkyline: aboveSkyline(s.earth?.elDeg ?? null, s.earth?.azDeg ?? null, data.earthHorizon.anglesDeg, data.earthHorizon.azimuthStepDeg),
  }));
  return { sun, earth, batteryWh: data.samples.map(s => byUtc.get(s.utc) ?? null) };
}
