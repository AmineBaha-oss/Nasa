import type { CameraMode, SceneLayers } from '../scene3d/types';
import { DEFAULT_LAYERS } from '../scene3d/types';

export type ViewMode = '2d' | '3d';
export type PlaySpeed = 1 | 4 | 12 | 24;

export interface NavigatorState {
  datasetIndex: number;
  sampleIndex: number;
  hardwareIndex: number;
  yawDeg: number;
  view: ViewMode;
  layers: SceneLayers;
  cameraMode: CameraMode;
  playing: boolean;
  speed: PlaySpeed;
  verticalExaggeration: number;
  detailsOpen: boolean;
  dockCollapsed: boolean;
}

export type NavigatorAction =
  | { type: 'setDataset'; index: number; sampleCount: number }
  | { type: 'setSample'; index: number; sampleCount: number }
  | { type: 'setHardware'; index: number }
  | { type: 'setYaw'; deg: number }
  | { type: 'nudgeYaw'; delta: number }
  | { type: 'setView'; view: ViewMode }
  | { type: 'toggleView' }
  | { type: 'toggleLayer'; key: keyof SceneLayers }
  | { type: 'setLayers'; layers: SceneLayers }
  | { type: 'setCameraMode'; mode: CameraMode }
  | { type: 'setPlaying'; playing: boolean }
  | { type: 'setSpeed'; speed: PlaySpeed }
  | { type: 'setVerticalExaggeration'; value: number }
  | { type: 'setDetailsOpen'; open: boolean }
  | { type: 'setDockCollapsed'; collapsed: boolean }
  | { type: 'hydrate'; partial: Partial<NavigatorState>; sampleCount: number; datasetCount: number; hardwareCount: number };

export function wrapYaw(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  return ((Math.round(deg) % 360) + 360) % 360;
}

export function clampIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return Math.max(0, Math.min(Math.floor(index), count - 1));
}

export function createInitialState(opts?: {
  datasetIndex?: number; sampleIndex?: number; hardwareIndex?: number; yawDeg?: number; view?: ViewMode;
}): NavigatorState {
  return {
    datasetIndex: opts?.datasetIndex ?? 0,
    sampleIndex: opts?.sampleIndex ?? 0,
    hardwareIndex: opts?.hardwareIndex ?? 0,
    yawDeg: wrapYaw(opts?.yawDeg ?? 0),
    view: opts?.view ?? '2d',
    layers: { ...DEFAULT_LAYERS },
    cameraMode: 'orbit',
    playing: false,
    speed: 4,
    verticalExaggeration: 1,
    detailsOpen: false,
    dockCollapsed: false,
  };
}

export function navigatorReducer(state: NavigatorState, action: NavigatorAction): NavigatorState {
  switch (action.type) {
    case 'setDataset': {
      const datasetIndex = Math.max(0, action.index);
      return { ...state, datasetIndex, sampleIndex: clampIndex(0, action.sampleCount), playing: false };
    }
    case 'setSample':
      return { ...state, sampleIndex: clampIndex(action.index, action.sampleCount) };
    case 'setHardware':
      return { ...state, hardwareIndex: Math.max(0, action.index) };
    case 'setYaw':
      return { ...state, yawDeg: wrapYaw(action.deg) };
    case 'nudgeYaw':
      return { ...state, yawDeg: wrapYaw(state.yawDeg + action.delta) };
    case 'setView':
      return { ...state, view: action.view, playing: action.view === '2d' ? false : state.playing };
    case 'toggleView':
      return navigatorReducer(state, { type: 'setView', view: state.view === '2d' ? '3d' : '2d' });
    case 'toggleLayer':
      return { ...state, layers: { ...state.layers, [action.key]: !state.layers[action.key] } };
    case 'setLayers':
      return { ...state, layers: { ...action.layers } };
    case 'setCameraMode':
      return { ...state, cameraMode: action.mode };
    case 'setPlaying':
      return { ...state, playing: action.playing };
    case 'setSpeed':
      return { ...state, speed: action.speed };
    case 'setVerticalExaggeration': {
      const value = Number.isFinite(action.value) ? Math.max(1, Math.min(5, action.value)) : 1;
      return { ...state, verticalExaggeration: value };
    }
    case 'setDetailsOpen':
      return { ...state, detailsOpen: action.open };
    case 'setDockCollapsed':
      return { ...state, dockCollapsed: action.collapsed };
    case 'hydrate': {
      const p = action.partial;
      return {
        ...state,
        datasetIndex: clampIndex(p.datasetIndex ?? state.datasetIndex, action.datasetCount),
        sampleIndex: clampIndex(p.sampleIndex ?? state.sampleIndex, action.sampleCount),
        hardwareIndex: clampIndex(p.hardwareIndex ?? state.hardwareIndex, action.hardwareCount),
        yawDeg: wrapYaw(p.yawDeg ?? state.yawDeg),
        view: p.view === '3d' || p.view === '2d' ? p.view : state.view,
        layers: p.layers ? { ...DEFAULT_LAYERS, ...p.layers } : state.layers,
        cameraMode: p.cameraMode ?? state.cameraMode,
        speed: ([1, 4, 12, 24] as const).includes(p.speed as PlaySpeed) ? p.speed as PlaySpeed : state.speed,
        verticalExaggeration: p.verticalExaggeration ?? state.verticalExaggeration,
        playing: false,
      };
    }
    default:
      return state;
  }
}
