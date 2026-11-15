// SYNTHETIC UNIT TESTS ONLY. Hardware is the hypothetical preset set.
import { describe, expect, it } from 'vitest';
import { Euler, Vector3 } from 'three';
import type { Vec3 } from '../engine/power';
import { HARDWARE_PRESETS } from '../integration/hardware';
import { bodyToLocal } from './frames';
import { ANTENNA_MAST, BODY, HARDWARE_GAP_M, PANEL_THICKNESS_M, gimbalPatch, headingLocal, panelLayout, panelSweepRadius, trackerAngles } from './hardwareLayout';

const close = (a: Vec3, b: Vec3) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 12));
const sphere = (phi: number, theta: number): Vec3 => [-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta)];
const panTilt = (pan: number, tilt: number): Vec3 => {
  const p = pan * Math.PI / 180, t = tilt * Math.PI / 180;
  return bodyToLocal([Math.sin(p) * Math.cos(t), Math.cos(p) * Math.cos(t), Math.sin(t)]);
};

describe('panelLayout', () => {
  it('every preset draws the same total panel area', () => {
    for (const h of HARDWARE_PRESETS) {
      const total = panelLayout(h).reduce((s, p) => s + p.sideM * p.sideM, 0);
      expect(total).toBeCloseTo(h.totalActivePvAreaM2, 12);
    }
  });
  it('the four-face array puts each panel outside its face at panel height', () => {
    const layout = panelLayout(HARDWARE_PRESETS[0]);
    expect(layout.map(p => p.name)).toEqual(['forward', 'right', 'aft', 'left']);
    close(layout[0].restNormal, [0, 0, -1]);
    close(layout[1].restNormal, [1, 0, 0]);
    for (const p of layout) {
      expect(p.centre[1]).toBe(2);
      expect(p.centre[0] * p.restNormal[0] + p.centre[2] * p.restNormal[2]).toBeGreaterThan(0.9);
    }
  });
  it('trackers keep their limit; the ideal tracker has none', () => {
    expect(panelLayout(HARDWARE_PRESETS[2])[0].maxTrackingAngleDeg).toBe(60);
    expect(panelLayout(HARDWARE_PRESETS[3])[0].maxTrackingAngleDeg).toBeNull();
  });
  it('keeps the entire tracker sweep outside the deck and antenna, without changing observer height', () => {
    const deckRadius = BODY.halfWidthM / Math.cos(Math.PI / 8) + 0.05;
    for (const hardware of HARDWARE_PRESETS.slice(2)) {
      const p = panelLayout(hardware)[0];
      const radius = panelSweepRadius(p.sideM);
      expect(-p.centre[0] - radius).toBeGreaterThanOrEqual(deckRadius + HARDWARE_GAP_M - 1e-12);
      expect(Math.hypot(p.centre[0] - ANTENNA_MAST[0], p.centre[2] - ANTENNA_MAST[2]) - radius).toBeGreaterThan(0.6);
      expect(p.centre[1]).toBe(hardware.panelHeightM);
    }
  });
  it('spaces multiple tracked panels by their full swept envelopes', () => {
    const h = HARDWARE_PRESETS[2];
    const panels = panelLayout({ ...h, panels: [h.panels[0], h.panels[0]].map(p => ({ ...p, areaFraction: 0.5 })) });
    expect(Math.abs(panels[0].centre[0] - panels[1].centre[0]))
      .toBeGreaterThanOrEqual(panelSweepRadius(panels[0].sideM) + panelSweepRadius(panels[1].sideM) + HARDWARE_GAP_M - 1e-12);
  });
  it('pan/tilt preserves pointing and clears the cradle throughout a full orientation sweep', () => {
    const p = panelLayout(HARDWARE_PRESETS[3])[0];
    const half = p.sideM / 2;
    for (let az = 0; az < 360; az += 10) {
      for (let el = -90; el <= 90; el += 10) {
        const normal = panTilt(az, el);
        const { pan, tilt } = trackerAngles(normal);
        const rotation = new Euler(tilt, pan, 0, 'YXZ');
        close(new Vector3(0, 0, 1).applyEuler(rotation).toArray(), normal);
        for (const x of [-half, half]) for (const y of [-half, half]) for (const z of [-PANEL_THICKNESS_M / 2, PANEL_THICKNESS_M / 2]) {
          const corner = new Vector3(x, y, z).applyEuler(rotation);
          expect(corner.length()).toBeLessThanOrEqual(panelSweepRadius(p.sideM) + 1e-12);
          // Undo the cradle pan: the bearings are outside x=±(half + .14), crossbar below -half-.2.
          corner.applyAxisAngle(new Vector3(0, 1, 0), -pan);
          expect(Math.abs(corner.x)).toBeLessThan(half + 0.14 - 0.035);
          expect(corner.y).toBeGreaterThan(-half - 0.2 + 0.035);
        }
      }
    }
  });
  it('skips panels with a zero normal or no area', () => {
    const h = { ...HARDWARE_PRESETS[0], panels: [{ ...HARDWARE_PRESETS[0].panels[0], normalBodyRFU: [0, 0, 0] as Vec3 }] };
    expect(panelLayout(h)).toEqual([]);
  });
});

describe('gimbalPatch', () => {
  const g = { panMinDeg: -90, panMaxDeg: 90, tiltMinDeg: -10, tiltMaxDeg: 60 };
  it('maps the patch corners to the pan/tilt limits', () => {
    const p = gimbalPatch(g);
    close(sphere(p.phiStart, p.thetaStart), panTilt(90, 60));
    close(sphere(p.phiStart + p.phiLength, p.thetaStart), panTilt(-90, 60));
    close(sphere(p.phiStart + p.phiLength / 2, p.thetaStart + p.thetaLength), panTilt(0, -10));
  });
  it('maps an asymmetric pan range', () => {
    const p = gimbalPatch({ ...g, panMinDeg: 10, panMaxDeg: 40 });
    close(sphere(p.phiStart, p.thetaStart), panTilt(40, 60));
    close(sphere(p.phiStart + p.phiLength, p.thetaStart), panTilt(10, 60));
  });
});

describe('headingLocal', () => {
  it('body heading 0 is forward (-z) and 180 is aft (+z)', () => {
    close(headingLocal(0), [0, 0, -1]);
    close(headingLocal(180), [0, 0, 1]);
    close(headingLocal(90), [1, 0, 0]);
  });
});
