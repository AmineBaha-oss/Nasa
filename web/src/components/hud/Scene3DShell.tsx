import { lazy, Suspense, useMemo } from 'react';
import type { HardwareConfig, HeadingEvaluation, SiteDateData, SiteTerrain } from '../../contracts';
import { sampleReadout, windowTracks } from '../../scene3d/readouts';
import type { LanderSceneProps } from '../../scene3d/types';
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

export function Scene3DShell(p: Props) {
  const reduced = prefersReducedMotion();
  const tracks = useMemo(
    () => windowTracks(p.data, p.hardware, p.deferredYaw),
    [p.data, p.hardware, p.deferredYaw],
  );
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
  };

  return (
    <div className="lp3-shell">
      <div className="lp3-canvas-wrap">
        <WebGlErrorBoundary onFallback={p.onFallback2d}>
          <Suspense fallback={<div className="lp3-loading" role="status">Loading 3D scene…</div>}>
            <LanderScene {...sceneProps} />
          </Suspense>
        </WebGlErrorBoundary>
        <div className="lp3-mini-chips">
          <QualityChips data={p.data} hardware={p.hardware} />
        </div>
        <StatusPills data={p.data} evaluation={p.evaluation} now={now}
          onOpenReason={code => p.onDetails(true, code)} />
      </div>
      <ControlDock
        datasets={p.datasets} hardwarePresets={p.hardwarePresets} state={p.state}
        data={p.data} hardware={p.hardware} collapsed={p.state.dockCollapsed}
        onToggleCollapsed={() => p.onDockCollapsed(!p.state.dockCollapsed)}
        onDataset={p.onDataset} onHardware={p.onHardware} onYaw={p.onYaw} onNudgeYaw={p.onNudgeYaw}
        onToggleLayer={p.onToggleLayer} onResetLayers={p.onResetLayers}
        onCameraMode={p.onCameraMode} onExaggeration={p.onExaggeration}
      />
      <Timeline
        data={p.data} sampleIndex={p.state.sampleIndex} onSample={p.onSample}
        playing={p.state.playing} onPlaying={p.onPlaying} speed={p.state.speed} onSpeed={p.onSpeed}
        sun={tracks.sun} earth={tracks.earth} batteryWh={tracks.batteryWh} reducedMotion={reduced}
      />
      <DetailsDrawer
        open={p.state.detailsOpen} onClose={() => p.onDetails(false)}
        data={p.data} hardware={p.hardware} evaluation={p.evaluation}
        alternatives={p.alternatives} yawDeg={p.deferredYaw} focus={p.focus}
      />
    </div>
  );
}
