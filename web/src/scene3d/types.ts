import type { EphemerisSample, HardwareConfig, HeadingEvaluation, SiteDateData, SiteTerrain } from '../contracts';

export type CameraMode = 'orbit' | 'lander' | 'top' | 'hardware';
export interface SceneLayers {
  terrain: boolean; slopeColours: boolean; skyline: boolean; sunPath: boolean; earthPath: boolean;
  antennaBeam: boolean; panelGlow: boolean; ramp: boolean; footprint: boolean; labels: boolean;
}
export interface LanderSceneProps {
  data: SiteDateData;
  terrain: SiteTerrain | null;
  sampleIndex: number;            // index into data.samples
  hardware: HardwareConfig;
  yawDeg: number;                 // clockwise from north
  evaluation: HeadingEvaluation | null;
  layers: SceneLayers;
  cameraMode: CameraMode;
  verticalExaggeration: number;   // 1 = true scale; HUD labels any other value
  reducedMotion: boolean;
  onYawChange?: (yawDeg: number) => void;   // dragging the heading ring
  onCameraModeChange?: (mode: CameraMode) => void;
}
export const DEFAULT_LAYERS: SceneLayers = {
  terrain: true, slopeColours: false, skyline: true, sunPath: true, earthPath: true,
  antennaBeam: true, panelGlow: true, ramp: true, footprint: true, labels: true,
};

// Keep EphemerisSample in the type surface for Person A's later scene code.
export type { EphemerisSample };
