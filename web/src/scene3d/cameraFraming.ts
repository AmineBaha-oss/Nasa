import type { HardwareConfig } from '../contracts';
import type { Vec3 } from '../engine/power';
import { ANTENNA_MAST, headingLocal, panelLayout, panelSweepRadius } from './hardwareLayout';
import { yawToRotationY } from './frames';

/** Visual bounds only. Hardware dimensions and observer heights are not changed to fit the view. */
export function hardwareFrame(hardware: HardwareConfig, yawDeg: number, selected: string | null = null): { target: Vec3; radius: number } {
  const panels = panelLayout(hardware);
  const antenna: Vec3 = [ANTENNA_MAST[0], hardware.antennaHeightM, ANTENNA_MAST[2]];
  const panel = panels.find(p => `panel-${p.index}` === selected);
  let target: Vec3, radius: number;
  if (selected === 'antenna') { target = antenna; radius = 2; }
  else if (panel) { target = panel.centre; radius = Math.max(2, panelSweepRadius(panel.sideM) + 0.6); }
  else {
    const footprint = hardware.landingFootprintRadiusM ?? 2;
    const low: Vec3 = [-footprint, 0, -footprint], high: Vec3 = [footprint, hardware.antennaHeightM + 0.6, footprint];
    const include = (point: Vec3, r: number) => point.forEach((v, i) => { low[i] = Math.min(low[i], v - r); high[i] = Math.max(high[i], v + r); });
    panels.forEach(p => include(p.centre, panelSweepRadius(p.sideM) + 0.2));
    include(antenna, 0.6);
    if (hardware.rampHeadingBodyDeg !== undefined) {
      const ramp = headingLocal(hardware.rampHeadingBodyDeg);
      include([ramp[0] * 3.3, 0, ramp[2] * 3.3], 0.4);
    }
    target = low.map((v, i) => (v + high[i]) / 2) as Vec3;
    radius = Math.hypot(...high.map((v, i) => (v - low[i]) / 2));
  }
  const angle = yawToRotationY(yawDeg), c = Math.cos(angle), s = Math.sin(angle);
  return { target: [target[0] * c + target[2] * s, target[1], -target[0] * s + target[2] * c], radius };
}

export function framingDistance(radius: number, aspect: number, verticalFovDeg = 45): number {
  const vertical = verticalFovDeg * Math.PI / 360;
  const halfAngle = Math.min(vertical, Math.atan(Math.tan(vertical) * Math.max(0.1, aspect)));
  return radius / Math.sin(halfAngle) * 1.08;
}
