import { useMemo, useRef, type ReactNode, type RefObject } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import { ILLUSTRATIVE_DEPLOYMENT_THRESHOLDS } from '../integration/hardware';
import { CameraRig, type CameraApi } from './CameraRig';
import { azElToThree } from './frames';
import { HeadingRing } from './HeadingRing';
import { Label, OverlayContext } from './Label';
import { Lander } from './Lander';
import { PALETTE } from './palette';
import { RangeRings } from './RangeRings';
import { sampleReadout, windowTracks } from './readouts';
import { Sky, SunLight } from './Sky';
import { SkylineRing } from './SkylineRing';
import { Terrain } from './Terrain';
import { terrainHeightAt } from './terrainMesh';
import type { CameraMode, LanderSceneProps } from './types';
import './scene3d.css';

/** Visual radii, not distances: the skyline and sky are drawn by angle as seen from the lander. */
const SKYLINE_RADIUS_M = 600;
const SKY_RADIUS_M = 900;
const SKYLINE_FLOOR_Y = -90;
const COMPASS_RADIUS_M = 40;

const HELP: Record<CameraMode, string> = {
  orbit: 'Drag to orbit, right-drag to pan, scroll to zoom. Double-click the ground to focus there. Drag the orange ring to turn the lander.',
  top: 'Drag to pan, right-drag to rotate, scroll to zoom. Drag the orange ring to turn the lander.',
  hardware: 'Drag to orbit, scroll to zoom. Hover a panel or the dish for its readout. The view turns slowly until you touch it.',
  lander: 'Drag to look around from the mast, scroll to zoom. The view follows the lander heading.',
};

function Compass({ props }: { props: LanderSceneProps }) {
  return <>{(['N', 'E', 'S', 'W'] as const).map((name, i) => {
    const [x, , z] = azElToThree(i * 90, 0).map(v => v * COMPASS_RADIUS_M);
    const h = props.terrain ? terrainHeightAt(props.terrain, props.data.site, x, -z, props.verticalExaggeration) : null;
    return <Label key={name} position={[x, (h ?? 0) + 1.2, z]} tone={name === 'N' ? PALETTE.paper : undefined}>{name}</Label>;
  })}</>;
}

/** Image-based light for reflections on metal and cells; rebuilt when the Sun bearing moves by more than 10 degrees. */
function Reflections({ sunAzDeg }: { sunAzDeg: number | null }) {
  const bucket = sunAzDeg === null ? 'none' : String(Math.round(sunAzDeg / 10) * 10);
  const warm = sunAzDeg === null ? null : azElToThree(Number(bucket), 4);
  return (
    <Environment key={bucket} resolution={128} frames={1} environmentIntensity={0.55}>
      <color attach="background" args={['#05070b']} />
      <Lightformer form="rect" intensity={0.6} color={PALETTE.fill} scale={[30, 30, 1]} position={[0, 12, 0]} rotation={[Math.PI / 2, 0, 0]} />
      <Lightformer form="rect" intensity={0.35} color="#8a7f6d" scale={[40, 4, 1]} position={[0, -3, 0]} rotation={[-Math.PI / 2, 0, 0]} />
      {warm && <Lightformer form="rect" intensity={4} color={PALETTE.sunLight} scale={[10, 2.5, 1]}
        position={[warm[0] * 10, warm[1] * 10 + 0.5, warm[2] * 10]} target={[0, 0, 0]} />}
    </Environment>
  );
}

function SceneContents(props: LanderSceneProps & { apiRef: RefObject<CameraApi | null>; needleRef: RefObject<HTMLSpanElement | null> }) {
  const { data, hardware, yawDeg, sampleIndex, layers, cameraMode } = props;
  const tracks = useMemo(() => windowTracks(data, hardware, yawDeg), [data, hardware, yawDeg]);
  const readout = useMemo(() => sampleReadout(data, hardware, yawDeg, sampleIndex, tracks), [data, hardware, yawDeg, sampleIndex, tracks]);
  const hardwareLabels = layers.labels && cameraMode === 'hardware';
  const sceneLayers = cameraMode === 'lander' ? { ...layers, antennaBeam: false } : layers;
  const sunAzDeg = readout?.sun.azDeg ?? tracks.sun.find(p => p.azDeg !== null)?.azDeg ?? null;
  return (
    <>
      <color attach="background" args={[PALETTE.space]} />
      <fog attach="fog" args={[PALETTE.space, 160, 420]} />
      <SunLight readout={readout} />
      <Reflections sunAzDeg={sunAzDeg} />
      {layers.terrain && (
        <Terrain terrain={props.terrain} site={data.site} verticalExaggeration={props.verticalExaggeration}
          slopeColours={layers.slopeColours} slopeLimitDeg={ILLUSTRATIVE_DEPLOYMENT_THRESHOLDS.maxFootprintSlopeDeg} />
      )}
      {layers.skyline && (
        <>
          <SkylineRing horizon={data.sunHorizon} eyeHeightM={hardware.panelHeightM} radiusM={SKYLINE_RADIUS_M} floorY={SKYLINE_FLOOR_Y}
            colour={PALETTE.sun} wall label="sun-skyline" />
          <SkylineRing horizon={data.earthHorizon} eyeHeightM={hardware.antennaHeightM} radiusM={SKYLINE_RADIUS_M - 8} floorY={SKYLINE_FLOOR_Y}
            colour={PALETTE.earth} wall={false} label="earth-skyline" />
        </>
      )}
      <Sky sunTrack={tracks.sun} earthTrack={tracks.earth} sampleIndex={sampleIndex} readout={readout} radiusM={SKY_RADIUS_M}
        showSunPath={layers.sunPath} showEarthPath={layers.earthPath} labels={layers.labels} />
      <Lander hardware={hardware} yawDeg={yawDeg} readout={readout} earthPoint={tracks.earth[sampleIndex]} evaluation={props.evaluation}
        terrain={props.terrain} site={data.site} verticalExaggeration={props.verticalExaggeration} layers={sceneLayers}
        hardwareLabels={hardwareLabels} reducedMotion={props.reducedMotion} />
      {cameraMode !== 'lander' && <HeadingRing yawDeg={yawDeg} onYawChange={props.onYawChange} />}
      {layers.labels && <Compass props={props} />}
      {layers.terrain && <RangeRings terrain={props.terrain} site={data.site} verticalExaggeration={props.verticalExaggeration} labels={layers.labels} />}
      <CameraRig mode={cameraMode} yawDeg={yawDeg} eyeHeightM={Math.max(hardware.panelHeightM, hardware.antennaHeightM) + 0.8}
        sunAzDeg={sunAzDeg} reducedMotion={props.reducedMotion} resetKey={data.site.id} apiRef={props.apiRef} needleRef={props.needleRef} insets={props.viewInsets} />
    </>
  );
}

function NavButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return <button type="button" className="lp3d-nav-btn" aria-label={label} title={label} onClick={onClick}>{children}</button>;
}

/** Map-style navigation widget: compass (click for north up), zoom, rotate and reset. */
function NavWidget({ api, needle, mode }: { api: RefObject<CameraApi | null>; needle: RefObject<HTMLSpanElement | null>; mode: CameraMode }) {
  return (
    <div className="lp3d-nav" role="toolbar" aria-label="Camera navigation" aria-orientation="vertical">
      <button type="button" className="lp3d-nav-btn lp3d-compass" aria-label="Turn view to north" title="Turn view to north" onClick={() => api.current?.northUp()}>
        <span ref={needle} className="lp3d-needle" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="26" height="26">
            <path d="M12 2 L16 12 L8 12 Z" fill="#ff6a3d" />
            <path d="M12 22 L8 12 L16 12 Z" fill="#c9ced6" />
            <text x="12" y="10.5" textAnchor="middle" fontSize="5" fontWeight="700" fill="#03050a">N</text>
          </svg>
        </span>
      </button>
      <div className="lp3d-nav-group">
        <NavButton label="Zoom in" onClick={() => api.current?.zoom(1)}><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg></NavButton>
        <NavButton label="Zoom out" onClick={() => api.current?.zoom(-1)}><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg></NavButton>
      </div>
      <div className="lp3d-nav-group">
        <NavButton label="Rotate view 45 degrees left" onClick={() => api.current?.rotate(-45)}><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M5 4.5A5 5 0 1 1 3.2 9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><path d="M2.5 2.5v3.5H6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg></NavButton>
        <NavButton label="Rotate view 45 degrees right" onClick={() => api.current?.rotate(45)}><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M11 4.5A5 5 0 1 0 12.8 9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><path d="M13.5 2.5v3.5H10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg></NavButton>
      </div>
      <NavButton label="Reset view" onClick={() => api.current?.reset()}><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M2.5 8 8 3l5.5 5M4.5 6.5V13h7V6.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg></NavButton>
      <details className="lp3d-help">
        <summary aria-label="How to move the camera" title="How to move the camera">?</summary>
        <p>{HELP[mode]}</p>
      </details>
    </div>
  );
}

/**
 * Interactive 3D view of one site, period, sample, hardware preset and heading.
 * A renderer of engine output only: statuses, power and visibility come from the engines, never from three.js.
 * The parent must give this a non-zero height.
 */
export default function LanderScene(props: LanderSceneProps) {
  const overlay = useRef<HTMLDivElement>(null);
  const api = useRef<CameraApi>(null);
  const needle = useRef<HTMLSpanElement>(null);
  const spin = props.cameraMode === 'hardware' && !props.reducedMotion;
  return (
    <div className="lp3d-root">
      <Canvas frameloop={spin ? 'always' : 'demand'} dpr={[1, 2]} shadows="percentage"
        onCreated={({ gl }) => { gl.toneMappingExposure = 1.1; }}
        camera={{ position: [11, 6.5, 13], fov: 45, near: 0.05, far: 4000 }} aria-label="3D lander scene">
        <OverlayContext.Provider value={overlay as RefObject<HTMLDivElement>}>
          <SceneContents {...props} apiRef={api} needleRef={needle} />
        </OverlayContext.Provider>
      </Canvas>
      <div ref={overlay} className="lp3d-overlay" />
      <NavWidget api={api} needle={needle} mode={props.cameraMode} />
      <details className="lp3d-caption">
        <summary>About this view</summary>
        <p>
          Skyline and sky are drawn by angle, not distance. The Sun is drawn larger than life. Sunlight direction and strength come from the engine;
          the blue fill light, reflections, ground grain and the boost that lets grazing sunlight show on flat ground are display aids.
          Terrain shadows are not modelled; only the lander casts a shadow.
          {props.verticalExaggeration !== 1 && ` Heights are exaggerated ×${props.verticalExaggeration}.`}
        </p>
      </details>
    </div>
  );
}
