import type { PowerHardware } from './hardware';

/**
 * ILLUSTRATIVE ONLY. Invented round numbers for comparing array geometries; not NASA, CLPS or any
 * real lander specification, and not approved by the team (HARDWARE-001/002 in docs/INPUT_REQUESTS.md).
 * Every preset shares the same total active PV area and peak power so comparisons are fair.
 * Antenna fields are owned by the comms engine; integration merges them into a full HardwareConfig.
 */
const common = {
  identity: 'hypothetical',
  specificationSourceId: null,
  totalActivePvAreaM2: 2,
  peakSolarPowerW: 200,
  batteryCapacityWh: 1000,
  batteryInitialWh: 800,
  minReserveWh: 200,
  constantLoadW: 80,
  chargeEfficiency: 0.95,
  dischargeEfficiency: 0.95,
  panelHeightM: 2,
} as const satisfies Partial<PowerHardware>;

export const ILLUSTRATIVE_POWER_PRESETS: readonly PowerHardware[] = [
  {
    ...common,
    name: 'Illustrative fixed 4-face vertical array',
    panels: [
      { name: 'forward', areaFraction: 0.25, normalBodyRFU: [0, 1, 0], mode: 'fixed' },
      { name: 'right', areaFraction: 0.25, normalBodyRFU: [1, 0, 0], mode: 'fixed' },
      { name: 'aft', areaFraction: 0.25, normalBodyRFU: [0, -1, 0], mode: 'fixed' },
      { name: 'left', areaFraction: 0.25, normalBodyRFU: [-1, 0, 0], mode: 'fixed' },
    ],
  },
  {
    ...common,
    name: 'Illustrative fixed single vertical panel (body-forward)',
    panels: [{ name: 'forward', areaFraction: 1, normalBodyRFU: [0, 1, 0], mode: 'fixed' }],
  },
  {
    ...common,
    name: 'Illustrative Sun tracker with 60 deg pointing limit',
    panels: [{ name: 'tracker', areaFraction: 1, normalBodyRFU: [0, 1, 0], mode: 'tracked', maxTrackingAngleDeg: 60 }],
  },
  {
    ...common,
    name: 'Illustrative ideal Sun tracker (upper bound)',
    panels: [{ name: 'ideal tracker', areaFraction: 1, normalBodyRFU: [0, 1, 0], mode: 'tracked' }],
  },
];
