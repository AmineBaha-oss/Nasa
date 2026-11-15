import { describe, expect, it } from 'vitest';
import { HARDWARE_PRESETS } from '../integration/hardware';
import { hardwareFrame, framingDistance } from './cameraFraming';
import { panelLayout, panelSweepRadius } from './hardwareLayout';

// Hypothetical hardware, geometric camera checks only.
describe('hardware camera framing', () => {
  it('contains every panel sweep and the feet for every preset', () => {
    for (const hardware of HARDWARE_PRESETS) {
      const frame = hardwareFrame(hardware, 0);
      for (const panel of panelLayout(hardware)) {
        const distance = Math.hypot(...panel.centre.map((v, i) => v - frame.target[i]));
        // Panel envelope fits within the axis-aligned box used to obtain the framing sphere.
        expect(distance + panelSweepRadius(panel.sideM)).toBeLessThanOrEqual(frame.radius + 1e-12);
      }
      const foot = hardware.landingFootprintRadiusM ?? 2;
      for (const x of [-foot, foot]) for (const z of [-foot, foot]) {
        expect(Math.hypot(x - frame.target[0], frame.target[1], z - frame.target[2])).toBeLessThanOrEqual(frame.radius);
      }
    }
  });
  it('rotates an offset tracker focus with the body heading', () => {
    const a = hardwareFrame(HARDWARE_PRESETS[2], 0, 'panel-0');
    const b = hardwareFrame(HARDWARE_PRESETS[2], 90, 'panel-0');
    expect(b.target[0]).toBeCloseTo(-a.target[2], 12);
    expect(b.target[2]).toBeCloseTo(a.target[0], 12);
    expect(b.target[1]).toBe(a.target[1]);
    expect(b.radius).toBe(a.radius);
  });
  it('fits a sphere inside both portrait and landscape fields of view', () => {
    for (const aspect of [0.45, 1, 1.6]) {
      const distance = framingDistance(3, aspect);
      const halfVertical = 22.5 * Math.PI / 180;
      const halfHorizontal = Math.atan(Math.tan(halfVertical) * aspect);
      expect(distance * Math.sin(halfVertical)).toBeGreaterThan(3);
      expect(distance * Math.sin(halfHorizontal)).toBeGreaterThan(3);
    }
    expect(framingDistance(3, 0.45)).toBeGreaterThan(framingDistance(3, 1.6));
  });
});
