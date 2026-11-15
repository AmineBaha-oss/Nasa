import { useEffect, useImperativeHandle, useRef, type Ref, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CameraControls, CameraControlsImpl } from '@react-three/drei';
import type { Vec3 } from '../engine/power';
import type { HardwareConfig } from '../contracts';
import { azElToThree } from './frames';
import { hardwareFrame, framingDistance } from './cameraFraming';
import { useGuidance } from './PointingGuide';
import type { CameraMode, ViewInsets } from './types';

const { ACTION } = CameraControlsImpl;
const DEG = Math.PI / 180;
/** Hardware view turns slowly on its own; any user input pauses the turn for this long. */
const SPIN_RAD_PER_S = 0.12;
const SPIN_PAUSE_S = 5;

/** Imperative handle for the DOM navigation widget. */
export interface CameraApi {
  zoom(direction: 1 | -1): void;
  rotate(deg: number): void;
  northUp(): void;
  reset(): void;
}

interface Props {
  mode: CameraMode;
  yawDeg: number;
  eyeHeightM: number;
  /** Used only to pick a side-lit default view; null keeps a fixed bearing. */
  sunAzDeg: number | null;
  reducedMotion: boolean;
  /** Changes when the site changes, so the view resets. */
  resetKey: string;
  apiRef?: Ref<CameraApi>;
  /** Compass needle rotated every frame to show where north is on screen. */
  needleRef?: RefObject<HTMLElement | null>;
  insets?: ViewInsets;
  hardware: HardwareConfig;
}

/**
 * Moves the projection centre into the part of the canvas not covered by HUD panels, the way web maps apply padding.
 * The full frame keeps the canvas aspect so nothing is stretched.
 */
function useViewOffset(insets: ViewInsets | undefined) {
  const camera = useThree(s => s.camera);
  const size = useThree(s => s.size);
  const invalidate = useThree(s => s.invalidate);
  const key = useRef('');
  useEffect(() => { invalidate(); }, [insets, size, invalidate]);
  useEffect(() => () => { if ('clearViewOffset' in camera) camera.clearViewOffset(); key.current = ''; }, [camera]);
  useFrame(() => {
    if (!('isPerspectiveCamera' in camera)) return;
    const { width: w, height: h } = size;
    const dx = insets ? Math.round((insets.left - insets.right) / 2) : 0;
    const dy = insets ? Math.round((insets.top - insets.bottom) / 2) : 0;
    const next = `${w}x${h}:${dx},${dy}`;
    if (next === key.current || w === 0 || h === 0) return;
    key.current = next;
    const scale = Math.max((w + 2 * Math.abs(dx)) / w, (h + 2 * Math.abs(dy)) / h);
    const fw = w * scale, fh = h * scale;
    camera.aspect = w / h;
    camera.setViewOffset(fw, fh, (fw - w) / 2 - dx, (fh - h) / 2 - dy, w, h);
  }, -1);
}

const around = (bearingDeg: number, elDeg: number, dist: number, target: Vec3): Vec3 => {
  const [x, y, z] = azElToThree(bearingDeg, elDeg);
  return [target[0] + x * dist, target[1] + y * dist, target[2] + z * dist];
};

/** Default pose per mode: camera position and look-at target in three coordinates. */
function pose(mode: CameraMode, yawDeg: number, eyeHeightM: number, sunAzDeg: number | null): { position: Vec3; target: Vec3 } {
  switch (mode) {
    case 'orbit': {
      const target: Vec3 = [0, 1.2, 0];
      return { position: around((sunAzDeg ?? 135) + 125, 12, 28, target), target };
    }
    case 'top': return { position: [0, 170, 0.001], target: [0, 0, 0] };
    case 'hardware': {
      const target: Vec3 = [0, 1.7, 0];
      return { position: around(yawDeg + 35, 16, 7.5, target), target };
    }
    case 'lander': {
      const [x, , z] = azElToThree(yawDeg, 0);
      const eye: Vec3 = [-x * 0.6, eyeHeightM, -z * 0.6];
      return { position: eye, target: [eye[0] + x * 0.01, eye[1], eye[2] + z * 0.01] };
    }
    default: { const never: never = mode; return never; }
  }
}

function configure(c: CameraControlsImpl, mode: CameraMode) {
  const fpv = mode === 'lander';
  const top = mode === 'top';
  c.smoothTime = 0.25;
  c.draggingSmoothTime = 0.12;
  c.minDistance = fpv ? 0.01 : 2;
  c.maxDistance = fpv ? 0.01 : top ? 420 : mode === 'hardware' ? 120 : 320;
  c.minPolarAngle = 0;
  c.maxPolarAngle = top ? 0.0001 : fpv ? Math.PI * 0.8 : 85 * DEG;
  c.azimuthRotateSpeed = fpv ? -0.35 : 1;
  c.polarRotateSpeed = fpv ? -0.35 : 1;
  c.dollyToCursor = mode === 'orbit' || top;
  c.mouseButtons.left = top ? ACTION.TRUCK : ACTION.ROTATE;
  c.mouseButtons.right = top ? ACTION.ROTATE : fpv ? ACTION.NONE : ACTION.TRUCK;
  c.mouseButtons.middle = fpv ? ACTION.NONE : ACTION.DOLLY;
  c.mouseButtons.wheel = fpv ? ACTION.ZOOM : ACTION.DOLLY;
  c.touches.one = top ? ACTION.TOUCH_TRUCK : ACTION.TOUCH_ROTATE;
  c.touches.two = fpv ? ACTION.TOUCH_ZOOM : top ? ACTION.TOUCH_DOLLY_ROTATE : ACTION.TOUCH_DOLLY_TRUCK;
  c.touches.three = fpv ? ACTION.NONE : ACTION.TOUCH_TRUCK;
}

/**
 * Map-style camera: left drag orbits (pans in top view), right drag pans (rotates in top view), wheel zooms toward the cursor.
 * Lander view looks around from the mast. Views move smoothly; the pose resets only on mode or site change.
 */
export function CameraRig({ mode, yawDeg, eyeHeightM, sunAzDeg, reducedMotion, resetKey, apiRef, needleRef, insets, hardware }: Props) {
  useViewOffset(insets);
  const { selected } = useGuidance();
  const size = useThree(s => s.size);
  const controls = useRef<CameraControlsImpl>(null);
  const invalidate = useThree(s => s.invalidate);
  const lastInput = useRef(-Infinity);
  const clock = useRef(0);
  const latest = useRef({ yawDeg, eyeHeightM, sunAzDeg });
  latest.current = { yawDeg, eyeHeightM, sunAzDeg };
  const animate = !reducedMotion;

  const goHome = (transition: boolean) => {
    const c = controls.current;
    if (!c) return;
    const { yawDeg: y, eyeHeightM: h, sunAzDeg: s } = latest.current;
    const p = pose(mode, y, h, s);
    if (mode === 'hardware' || (mode === 'orbit' && selected !== null)) {
      const frame = hardwareFrame(hardware, y, selected);
      const availableWidth = Math.max(180, size.width - (insets?.left ?? 0) - (insets?.right ?? 0));
      const availableHeight = Math.max(180, size.height - (insets?.top ?? 0) - (insets?.bottom ?? 0));
      const offsetScale = Math.max(1 + Math.abs((insets?.left ?? 0) - (insets?.right ?? 0)) / size.width,
        1 + Math.abs((insets?.top ?? 0) - (insets?.bottom ?? 0)) / size.height);
      const effectiveFov = 2 * Math.atan(Math.tan(22.5 * DEG) * availableHeight / (size.height * offsetScale)) / DEG;
      p.target = frame.target;
      p.position = around(selected ? c.azimuthAngle / DEG : y + 35, selected ? Math.max(18, 90 - c.polarAngle / DEG) : 24,
        framingDistance(frame.radius, availableWidth / availableHeight, effectiveFov), frame.target);
    }
    void c.zoomTo(1, transition);
    void c.setLookAt(...p.position, ...p.target, transition);
    invalidate();
  };

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    configure(c, mode);
    goHome(animate);
    // Pose resets on mode, site and eye-height changes only; heading changes are followed below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, resetKey, eyeHeightM, hardware, selected, size.width, size.height, insets]);

  const followYaw = mode === 'lander' || (selected && (mode === 'hardware' || mode === 'orbit')) ? yawDeg : null;
  useEffect(() => {
    if (followYaw === null) return;
    goHome(animate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followYaw]);

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const mark = () => { lastInput.current = clock.current; };
    c.addEventListener('controlstart', mark);
    c.addEventListener('control', mark);
    return () => { c.removeEventListener('controlstart', mark); c.removeEventListener('control', mark); };
  }, []);

  useImperativeHandle(apiRef, () => ({
    zoom(direction) {
      const c = controls.current;
      if (!c) return;
      lastInput.current = clock.current;
      if (mode === 'lander') void c.zoomTo(Math.min(6, Math.max(1, c.camera.zoom * (direction > 0 ? 1.5 : 1 / 1.5))), animate);
      else void c.dolly(direction > 0 ? c.distance * 0.35 : -c.distance * 0.55, animate);
      invalidate();
    },
    rotate(deg) {
      const c = controls.current;
      if (!c) return;
      lastInput.current = clock.current;
      void c.rotate(-deg * DEG, 0, animate);
      invalidate();
    },
    northUp() {
      const c = controls.current;
      if (!c) return;
      lastInput.current = clock.current;
      c.normalizeRotations();
      void c.rotateAzimuthTo(Math.round(c.azimuthAngle / (2 * Math.PI)) * 2 * Math.PI, animate);
      invalidate();
    },
    reset() { lastInput.current = -Infinity; goHome(animate); },
  }), [mode, animate, invalidate, hardware, selected, size, insets]);

  useFrame((_, delta) => {
    clock.current += delta;
    const c = controls.current;
    if (!c) return;
    if (mode === 'hardware' && !selected && animate && clock.current - lastInput.current > SPIN_PAUSE_S) {
      c.azimuthAngle += SPIN_RAD_PER_S * Math.min(delta, 0.1);
    }
    const needle = needleRef?.current;
    if (needle) needle.style.transform = `rotate(${(c.azimuthAngle / DEG).toFixed(1)}deg)`;
  });

  return <CameraControls ref={controls} makeDefault />;
}
