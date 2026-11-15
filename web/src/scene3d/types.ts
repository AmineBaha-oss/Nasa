import type { HeadingEvaluation, HardwareConfig, SiteDateData, SiteTerrain } from '../contracts';

/** Contract between the 3D scene (docs/3D_PLAN.md, Person A) and the HUD (Person B). Change only by agreement. */
export type CameraMode = 'orbit' | 'lander' | 'top' | 'hardware';

export interface SceneLayers {
  terrain: boolean; slopeColours: boolean; skyline: boolean; sunPath: boolean; earthPath: boolean;
  antennaBeam: boolean; panelGlow: boolean; ramp: boolean; footprint: boolean; labels: boolean;
}

export interface LanderSceneProps {
  data: SiteDateData;
  terrain: SiteTerrain | null;
  /** Index into data.samples. */
  sampleIndex: number;
  hardware: HardwareConfig;
  /** Clockwise from north. */
  yawDeg: number;
  evaluation: HeadingEvaluation | null;
  layers: SceneLayers;
  cameraMode: CameraMode;
  /** 1 is true scale; the HUD labels any other value. */
  verticalExaggeration: number;
  reducedMotion: boolean;
  onYawChange?: (yawDeg: number) => void;
  onCameraModeChange?: (mode: CameraMode) => void;
  /** CSS pixels of the canvas covered by HUD panels; the camera centres the scene in the uncovered area. */
  viewInsets?: ViewInsets;
}

export interface ViewInsets { top: number; right: number; bottom: number; left: number }

export const DEFAULT_LAYERS: SceneLayers = {
  terrain: true, slopeColours: false, skyline: true, sunPath: true, earthPath: true,
  antennaBeam: true, panelGlow: true, ramp: true, footprint: true, labels: true,
};
