import type { Antenna, HardwareConfig } from '../contracts';
import { ILLUSTRATIVE_POWER_PRESETS } from '../engine/power';
import type { DeploymentThresholds } from '../engine/terrain';

/**
 * HYPOTHETICAL. No hardware is approved (HARDWARE-001..004 in docs/INPUT_REQUESTS.md). These values only
 * exercise the engines; every preset shares this antenna and geometry so presets differ in the array alone.
 */
export const HYPOTHETICAL_ANTENNA: Antenna = {
  boresightBodyRFU: [0, 1, 0],
  beamHalfAngleDeg: 15,
  gimbal: { panMinDeg: -90, panMaxDeg: 90, tiltMinDeg: -10, tiltMaxDeg: 60 },
};

/** Heights match the science horizons (panels 2 m, antenna 3 m); a mismatch would make the engines report unknown. */
export const HYPOTHETICAL_GEOMETRY = {
  antennaHeightM: 3,
  rampHeadingBodyDeg: 180,
  landingFootprintRadiusM: 2,
} as const satisfies Partial<HardwareConfig>;

export const ILLUSTRATIVE_DEPLOYMENT_THRESHOLDS: DeploymentThresholds = {
  maxFootprintSlopeDeg: 10,
  maxRampSlopeDeg: 10,
  rampLengthM: 15,
  label: 'illustrative 10 deg footprint and ramp limits after VIPER draft examples, 15 m ramp; not a lunar standard',
};

export const HARDWARE_PRESETS: readonly HardwareConfig[] = ILLUSTRATIVE_POWER_PRESETS.map(power => ({
  ...power,
  name: power.name ?? 'Unnamed illustrative preset',
  identity: 'hypothetical',
  specificationSourceId: null,
  antenna: HYPOTHETICAL_ANTENNA,
  ...HYPOTHETICAL_GEOMETRY,
}));
