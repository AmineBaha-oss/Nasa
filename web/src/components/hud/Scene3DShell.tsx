import { lazy, Suspense, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { HardwareConfig, HeadingEvaluation, SiteDateData, SiteTerrain } from '../../contracts';
import { sampleReadout, windowTracks } from '../../scene3d/readouts';
import type { CameraMode, LanderSceneProps, ViewInsets } from '../../scene3d/types';
import type { NavigatorState } from '../../state/navigatorState';
import type { Alternative } from '../ComparisonTable';
import { QualityChips } from '../QualityChips';
import { ControlDock } from './ControlDock';
import { DetailsDrawer } from './DetailsDrawer';
import { Timeline } from './Timeline';
import { StatusPills } from './StatusPills';
import { WebGlErrorBoundary } from './WebGlErrorBoundary';
import { prefersReducedMotion } from '../../state/urlHash';

const LanderScene = lazy(() => import('../../scene3d/LanderScene'));

const CAMERAS: { mode: CameraMode; label: string; hint: string }[] = [
  { mode: 'orbit', label: 'Orbit', hint: 'Free orbit around the site' },
  { mode: 'hardware', label: 'Hardware', hint: 'Close up on panels and antenna' },
  { mode: 'top', label: 'Map', hint: 'Top-down map view' },
  { mode: 'lander', label: 'Lander eye', hint: 'Look around from the mast' },
];

interface Props {
  datasets: SiteDateData[];
  hardwarePresets: HardwareConfig[];
  state: NavigatorState;
  data: SiteDateData;
  hardware: HardwareConfig;
  terrain: SiteTerrain | null;
  evaluation: HeadingEvaluation | null;
  alternatives: Alternative[];
  deferredYaw: number;
  focus: 'solar' | 'battery' | 'antenna' | 'deployment' | null;
  /** Brand and 2D/3D switch, shown top-left over the scene. */
  topLeft?: ReactNode;
  onFallback2d: () => void;
  onDataset: (i: number) => void;
  onHardware: (i: number) => void;
  onSample: (i: number) => void;
  onYaw: (deg: number) => void;
  onNudgeYaw: (delta: number) => void;
  onToggleLayer: (key: keyof NavigatorState['layers']) => void;
  onResetLayers: () => void;
  onCameraMode: (mode: NavigatorState['cameraMode']) => void;
  onExaggeration: (v: number) => void;
  onPlaying: (p: boolean) => void;
  onSpeed: (s: NavigatorState['speed']) => void;
  onDetails: (open: boolean, focus?: Props['focus']) => void;
  onDockCollapsed: (c: boolean) => void;
}

/** Measures how much of the canvas the floating panels cover, so the camera can centre the scene in the free area. */
function useHudInsets(shell: RefObject<HTMLDivElement | null>, dockCollapsed: boolean): ViewInsets | undefined {
  const [insets, setInsets] = useState<ViewInsets>();
  useLayoutEffect(() => {
    const root = shell.current;
    if (!root || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const box = root.getBoundingClientRect();
      const dock = root.querySelector('.lp3-dock')?.getBoundingClientRect();
      const bottom = root.querySelector('.lp3-bottom')?.getBoundingClientRect();
      const cams = root.querySelector('.lp3-cameras')?.getBoundingClientRect();
      const sideDock = dock && dock.height > box.height * 0.45 && dock.width < box.width * 0.5;
      const next: ViewInsets = {
        top: cams ? Math.max(0, cams.bottom - box.top) : 0,
        right: box.width > 900 ? 64 : 0,
        bottom: bottom ? Math.max(0, box.bottom - bottom.top) : 0,
        left: sideDock ? Math.max(0, dock.right - box.left) : 0,
      };
      if (bottom) root.style.setProperty('--lp3-bottom-h', `${Math.round(bottom.height)}px`);
      setInsets(prev => (prev && prev.top === next.top && prev.right === next.right && prev.bottom === next.bottom && prev.left === next.left ? prev : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    root.querySelectorAll('.lp3-dock, .lp3-bottom').forEach(el => ro.observe(el));
    return () => ro.disconnect();
  }, [shell, dockCollapsed]);
  return insets;
}

export function Scene3DShell(p: Props) {
  const reduced = prefersReducedMotion();
  const shell = useRef<HTMLDivElement>(null);
  const viewInsets = useHudInsets(shell, p.state.dockCollapsed);
  const tracks = useMemo(() => windowTracks(p.data, p.hardware, p.deferredYaw), [p.data, p.hardware, p.deferredYaw]);
  const now = useMemo(
    () => sampleReadout(p.data, p.hardware, p.deferredYaw, p.state.sampleIndex, tracks),
    [p.data, p.hardware, p.deferredYaw, p.state.sampleIndex, tracks],
  );

  const sceneProps: LanderSceneProps = {
    data: p.data,
    terrain: p.terrain,
    sampleIndex: p.state.sampleIndex,
    hardware: p.hardware,
    yawDeg: p.state.yawDeg,
    evaluation: p.evaluation,
    layers: p.state.layers,
    cameraMode: p.state.cameraMode,
    verticalExaggeration: p.state.verticalExaggeration,
    reducedMotion: reduced,
    onYawChange: p.onYaw,
    onCameraModeChange: p.onCameraMode,
    viewInsets,
  };

  return (
    <div ref={shell} className={p.state.dockCollapsed ? 'lp3-shell is-dock-collapsed' : 'lp3-shell'}>
      <div className="lp3-canvas-wrap">
        <WebGlErrorBoundary onFallback={p.onFallback2d}>
          <Suspense fallback={<div className="lp3-loading" role="status">Loading 3D scene…</div>}>
            <LanderScene {...sceneProps} />
          </Suspense>
        </WebGlErrorBoundary>
      </div>

      <div className="lp3-topleft">
        {p.topLeft}
        <div className="lp3-mini-chips"><QualityChips data={p.data} hardware={p.hardware} /></div>
      </div>

      <div className="lp3-cameras" role="group" aria-label="Camera view">
        {CAMERAS.map(c => (
          <button key={c.mode} type="button" aria-pressed={p.state.cameraMode === c.mode} title={c.hint}
            className={p.state.cameraMode === c.mode ? 'is-active' : undefined} onClick={() => p.onCameraMode(c.mode)}>{c.label}</button>
        ))}
      </div>

      <ControlDock
        datasets={p.datasets} hardwarePresets={p.hardwarePresets} state={p.state}
        data={p.data} hardware={p.hardware} collapsed={p.state.dockCollapsed}
        sunAzDeg={now?.sun.azDeg ?? null} earthAzDeg={tracks.earth[p.state.sampleIndex]?.azDeg ?? null}
        onToggleCollapsed={() => p.onDockCollapsed(!p.state.dockCollapsed)}
        onDataset={p.onDataset} onHardware={p.onHardware} onYaw={p.onYaw} onNudgeYaw={p.onNudgeYaw}
        onToggleLayer={p.onToggleLayer} onResetLayers={p.onResetLayers}
        onCameraMode={p.onCameraMode} onExaggeration={p.onExaggeration}
      />

      <div className="lp3-bottom">
        <div className="lp3-bottom-head">
          <StatusPills data={p.data} evaluation={p.evaluation} now={now} onOpenReason={code => p.onDetails(true, code)} />
          <button type="button" className="lp3-details-btn" onClick={() => p.onDetails(true)}>Details and comparison</button>
        </div>
        <Timeline
          data={p.data} sampleIndex={p.state.sampleIndex} onSample={p.onSample}
          playing={p.state.playing} onPlaying={p.onPlaying} speed={p.state.speed} onSpeed={p.onSpeed}
          sun={tracks.sun} earth={tracks.earth} batteryWh={tracks.batteryWh} reducedMotion={reduced}
        />
      </div>

      <DetailsDrawer
        open={p.state.detailsOpen} onClose={() => p.onDetails(false)}
        data={p.data} hardware={p.hardware} evaluation={p.evaluation}
        alternatives={p.alternatives} yawDeg={p.deferredYaw} focus={p.focus}
        currentIndex={p.state.datasetIndex} onSelect={p.onDataset}
      />
    </div>
  );
}
