import type { Antenna, HardwareConfig, Panel } from '../contracts';
import type { Vec3 } from '../engine/power';
import { bodyToLocal } from './frames';

/**
 * Lander-local placement of hardware from a HardwareConfig (three.js axes inside the yawed group).
 * The body, mast offsets and dish size are illustrative drawing choices; panel areas, normals,
 * heights, beam width, gimbal limits and ramp heading come from the config.
 */
export const BODY = { halfWidthM: 0.9, bottomM: 0.6, topM: 1.6 } as const;
const PANEL_STANDOFF_M = BODY.halfWidthM + 0.18;
export const PANEL_THICKNESS_M = 0.035;
export const HARDWARE_GAP_M = 0.2;
export const ANTENNA_MAST: Vec3 = [0.5, 0, 0.55];

/** Conservative envelope for every orientation of the square panel, including its frame. */
export const panelSweepRadius = (sideM: number) => Math.hypot(sideM / Math.SQRT2, PANEL_THICKNESS_M / 2);

/** Two-axis yoke: yaw about vertical, then tilt about its horizontal axle. No roll twist. */
export function trackerAngles(normal: Vec3) {
  const n = unit(normal) ?? [0, 0, 1];
  return { pan: Math.atan2(n[0], n[2]), tilt: -Math.asin(Math.max(-1, Math.min(1, n[1]))) };
}

const unit = (v: Vec3): Vec3 | null => {
  const n = Math.hypot(...v);
  return n > 1e-12 && Number.isFinite(n) ? [v[0] / n, v[1] / n, v[2] / n] : null;
};

export interface PanelLayout {
  /** Index into hardware.panels (and SampleReadout.panels). */
  index: number;
  name: string;
  areaFraction: number;
  mode: Panel['mode'];
  /** Square side giving the panel's true area: areaFraction x totalActivePvAreaM2. */
  sideM: number;
  areaM2: number;
  /** Panel centre (fixed) or gimbal pivot (tracked), lander-local. */
  centre: Vec3;
  /** Nominal outward normal, lander-local unit vector. */
  restNormal: Vec3;
  maxTrackingAngleDeg: number | null;
}

export function panelLayout(hardware: Pick<HardwareConfig, 'panels' | 'totalActivePvAreaM2' | 'panelHeightM'>): PanelLayout[] {
  const out: PanelLayout[] = [];
  let trackerEdge = BODY.halfWidthM / Math.cos(Math.PI / 8) + 0.05;
  for (const [index, p] of hardware.panels.entries()) {
    const restNormal = unit(bodyToLocal(p.normalBodyRFU));
    const areaM2 = p.areaFraction * hardware.totalActivePvAreaM2;
    if (!restNormal || !(areaM2 > 0)) continue;
    const sideM = Math.sqrt(areaM2);
    const sweep = panelSweepRadius(sideM);
    const horizontal = unit([restNormal[0], 0, restNormal[2]]);
    const centre: Vec3 = p.mode === 'tracked'
      ? [-(trackerEdge + HARDWARE_GAP_M + sweep), hardware.panelHeightM, 0]
      : horizontal && Math.hypot(restNormal[0], restNormal[2]) > 0.1
        ? [horizontal[0] * PANEL_STANDOFF_M, hardware.panelHeightM, horizontal[2] * PANEL_STANDOFF_M]
        : [0, hardware.panelHeightM, 0];
    out.push({
      index, name: p.name, areaFraction: p.areaFraction, mode: p.mode, sideM, areaM2, centre, restNormal,
      maxTrackingAngleDeg: p.mode === 'tracked' && p.maxTrackingAngleDeg !== undefined ? p.maxTrackingAngleDeg : null,
    });
    if (p.mode === 'tracked') trackerEdge = -centre[0] + sweep;
  }
  return out;
}

/**
 * THREE.SphereGeometry phi/theta ranges (radians) covering the antenna's reachable pan/tilt box.
 * Sphere vertices are (-cos phi sin theta, cos theta, sin phi sin theta); pan p clockwise from body forward
 * and tilt t above horizontal give phi = -90 deg - p and theta = 90 deg - t.
 */
export function gimbalPatch(g: NonNullable<Antenna['gimbal']>) {
  const D = Math.PI / 180;
  const span = Math.min(360, g.panMaxDeg - g.panMinDeg);
  return {
    phiStart: (-90 - g.panMinDeg - span) * D,
    phiLength: span * D,
    thetaStart: (90 - g.tiltMaxDeg) * D,
    thetaLength: (g.tiltMaxDeg - g.tiltMinDeg) * D,
  };
}

/** Lander-local unit vector for a body heading clockwise from forward, on the ground plane. */
export function headingLocal(bodyHeadingDeg: number): Vec3 {
  const h = bodyHeadingDeg * Math.PI / 180;
  return bodyToLocal([Math.sin(h), Math.cos(h), 0]);
}
