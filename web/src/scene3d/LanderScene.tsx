import { useMemo, useRef, type RefObject } from 'react';
import { Canvas } from '@react-three/fiber';
import { ILLUSTRATIVE_DEPLOYMENT_THRESHOLDS } from '../integration/hardware';
import { CameraRig } from './CameraRig';
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
import type { LanderSceneProps } from './types';
import './scene3d.css';

/** Visual radii, not distances: the skyline and sky are drawn by angle as seen from the lander. */
const SKYLINE_RADIUS_M = 600;
const SKY_RADIUS_M = 900;
const SKYLINE_FLOOR_Y = -90;
const COMPASS_RADIUS_M = 40;

function Compass({ props }: { props: LanderSceneProps }) {
  return <>{(['N', 'E', 'S', 'W'] as const).map((name, i) => {
    const [x, , z] = azElToThree(i * 90, 0).map(v => v * COMPASS_RADIUS_M);
    const h = props.terrain ? terrainHeightAt(props.terrain, props.data.site, x, -z, props.verticalExaggeration) : null;
    return <Label key={name} position={[x, (h ?? 0) + 1.2, z]} tone={name === 'N' ? PALETTE.paper : undefined}>{name}</Label>;
  })}</>;
}

function SceneContents(props: LanderSceneProps) {
  const { data, hardware, yawDeg, sampleIndex, layers, cameraMode } = props;
  const tracks = useMemo(() => windowTracks(data, hardware, yawDeg), [data, hardware, yawDeg]);
  const readout = useMemo(() => sampleReadout(data, hardware, yawDeg, sampleIndex, tracks), [data, hardware, yawDeg, sampleIndex, tracks]);
  const hardwareLabels = layers.labels && cameraMode === 'hardware';
  const sceneLayers = cameraMode === 'lander' ? { ...layers, antennaBeam: false } : layers;
  return (
    <>
      <color attach="background" args={[PALETTE.space]} />
      <SunLight readout={readout} />
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
      <HeadingRing yawDeg={yawDeg} onYawChange={props.onYawChange} />
      {layers.labels && <Compass props={props} />}
      {layers.terrain && <RangeRings terrain={props.terrain} site={data.site} verticalExaggeration={props.verticalExaggeration} labels={layers.labels} />}
      <CameraRig mode={cameraMode} yawDeg={yawDeg} eyeHeightM={Math.max(hardware.panelHeightM, hardware.antennaHeightM) + 0.8}
        reducedMotion={props.reducedMotion} />
    </>
  );
}

/**
 * Interactive 3D view of one site, period, sample, hardware preset and heading.
 * A renderer of engine output only: statuses, power and visibility come from the engines, never from three.js.
 * The parent must give this a non-zero height.
 */
export default function LanderScene(props: LanderSceneProps) {
  const overlay = useRef<HTMLDivElement>(null);
  const spin = props.cameraMode === 'hardware' && !props.reducedMotion;
  return (
    <div className="lp3d-root">
      <Canvas frameloop={spin ? 'always' : 'demand'} dpr={[1, 2]} shadows="percentage"
        camera={{ position: [11, 6.5, 13], fov: 50, near: 0.05, far: 4000 }} aria-label="3D lander scene">
        <OverlayContext.Provider value={overlay as RefObject<HTMLDivElement>}>
          <SceneContents {...props} />
        </OverlayContext.Provider>
      </Canvas>
      <div ref={overlay} className="lp3d-overlay" />
      <p className="lp3d-caption">
        Skyline and sky drawn by angle, not distance · Sun drawn larger than life · lighting follows the engine; terrain shadows are not modelled
        {props.verticalExaggeration !== 1 && ` · heights ×${props.verticalExaggeration}`}
      </p>
    </div>
  );
}
