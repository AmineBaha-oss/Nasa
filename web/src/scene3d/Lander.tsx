import { useEffect, useLayoutEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import type { Group } from 'three';
import type { HardwareConfig, HeadingEvaluation, Site, SiteTerrain } from '../contracts';
import { bodyToEnu, type Vec3 } from '../engine/power';
import { ILLUSTRATIVE_DEPLOYMENT_THRESHOLDS } from '../integration/hardware';
import { yawToRotationY } from './frames';
import { BODY, headingLocal } from './hardwareLayout';
import { HardwareModel, Strut } from './HardwareModel';
import { Label } from './Label';
import { PALETTE, statusColour } from './palette';
import type { SampleReadout, TrackPoint } from './readouts';
import { terrainHeightAt } from './terrainMesh';
import type { SceneLayers } from './types';

const RAMP_PLANK_M = 2.4;

/** Turns the lander group toward the target yaw along the shortest way, then lets the demand loop idle. */
function useYawGroup(yawDeg: number, reducedMotion: boolean) {
  const ref = useRef<Group>(null);
  const invalidate = useThree(s => s.invalidate);
  const target = yawToRotationY(yawDeg);
  useLayoutEffect(() => { if (ref.current && ref.current.userData.placed !== true) { ref.current.rotation.y = target; ref.current.userData.placed = true; } });
  useEffect(() => { invalidate(); }, [target, invalidate]);
  useFrame((_, delta) => {
    const g = ref.current;
    if (!g) return;
    const diff = Math.atan2(Math.sin(target - g.rotation.y), Math.cos(target - g.rotation.y));
    if (reducedMotion || Math.abs(diff) < 1e-4) { g.rotation.y = target; return; }
    g.rotation.y = target - diff * Math.exp(-10 * Math.min(delta, 0.1));
    invalidate();
  });
  return ref;
}

interface RampProps {
  headingBodyDeg: number;
  status: HeadingEvaluation['deployment']['status'] | undefined;
  terrain: SiteTerrain | null;
  site: Site;
  yawDeg: number;
  verticalExaggeration: number;
  label: boolean;
}

/** Ramp plank plus the egress path the deployment check samples, draped on the DEM; gaps where terrain is unknown. */
function Ramp({ headingBodyDeg, status, terrain, site, yawDeg, verticalExaggeration, label }: RampProps) {
  const d = headingLocal(headingBodyDeg);
  const [e, n] = bodyToEnu([Math.sin(headingBodyDeg * Math.PI / 180), Math.cos(headingBodyDeg * Math.PI / 180), 0], yawDeg);
  const groundAt = (s: number) => (terrain ? terrainHeightAt(terrain, site, e * s, n * s, verticalExaggeration) : null);
  const start = BODY.halfWidthM + RAMP_PLANK_M;
  const length = ILLUSTRATIVE_DEPLOYMENT_THRESHOLDS.rampLengthM;
  const runs: Vec3[][] = [];
  let cur: Vec3[] | null = null;
  for (let s = start; s <= start + length + 1e-9; s += 0.5) {
    const h = groundAt(s);
    if (h === null) { cur = null; continue; }
    if (!cur) runs.push(cur = []);
    cur.push([d[0] * s, h + 0.06, d[2] * s]);
  }
  const tone = statusColour(status);
  const foot = groundAt(start) ?? 0;
  return (
    <group name="ramp">
      <Strut from={[d[0] * BODY.halfWidthM, BODY.bottomM, d[2] * BODY.halfWidthM]} to={[d[0] * start, foot + 0.05, d[2] * start]} radius={0.12} colour="#d7dbe0" />
      {runs.filter(r => r.length > 1).map((r, i) => <Line key={i} points={r} color={tone} lineWidth={3} dashed dashSize={0.6} gapSize={0.4} />)}
      {label && <Label position={[d[0] * (start + length), (runs.at(-1)?.at(-1)?.[1] ?? 0) + 0.8, d[2] * (start + length)]} tone={tone}>
        Ramp {length} m · deploy {status ?? 'unknown'} (prelim.)
      </Label>}
    </group>
  );
}

interface Props {
  hardware: HardwareConfig;
  yawDeg: number;
  readout: SampleReadout | null;
  earthPoint: TrackPoint | undefined;
  evaluation: HeadingEvaluation | null;
  terrain: SiteTerrain | null;
  site: Site;
  verticalExaggeration: number;
  layers: SceneLayers;
  hardwareLabels: boolean;
  reducedMotion: boolean;
}

export function Lander({ hardware, yawDeg, readout, earthPoint, evaluation, terrain, site, verticalExaggeration, layers, hardwareLabels, reducedMotion }: Props) {
  const group = useYawGroup(yawDeg, reducedMotion);
  const footprint = hardware.landingFootprintRadiusM ?? 2;
  const deployment = evaluation?.deployment.status;
  const legs: Vec3[] = [[1, 0, 1], [1, 0, -1], [-1, 0, 1], [-1, 0, -1]];
  const pad = footprint * Math.SQRT1_2;
  return (
    <group ref={group} name="lander">
      <mesh position={[0, (BODY.bottomM + BODY.topM) / 2, 0]} castShadow>
        <boxGeometry args={[BODY.halfWidthM * 2, BODY.topM - BODY.bottomM, BODY.halfWidthM * 2]} />
        <meshStandardMaterial color={PALETTE.foil} metalness={0.25} roughness={0.45} />
      </mesh>
      <mesh position={[0, BODY.topM + 0.02, 0]} castShadow>
        <boxGeometry args={[BODY.halfWidthM * 2 + 0.06, 0.04, BODY.halfWidthM * 2 + 0.06]} />
        <meshStandardMaterial color="#c3c8cf" metalness={0.3} roughness={0.5} />
      </mesh>
      {legs.map(([x, , z], i) => (
        <group key={i}>
          <Strut from={[x * 0.7, BODY.bottomM, z * 0.7]} to={[x * pad, 0.05, z * pad]} radius={0.05} />
          <mesh position={[x * pad, 0.04, z * pad]}><cylinderGeometry args={[0.18, 0.2, 0.06, 16]} /><meshStandardMaterial color="#b9c0c9" /></mesh>
        </group>
      ))}
      <mesh position={[0, BODY.topM + 0.12, -BODY.halfWidthM + 0.1]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.18, 0.5, 16]} />
        <meshStandardMaterial color={PALETTE.signal} emissive={PALETTE.signal} emissiveIntensity={0.4} />
      </mesh>
      {layers.labels && <Label position={[0, BODY.topM + 0.5, -BODY.halfWidthM - 0.3]} tone={PALETTE.signal}>FWD</Label>}
      <HardwareModel hardware={hardware} readout={readout} earthPoint={earthPoint} yawDeg={yawDeg}
        showBeam={layers.antennaBeam} glow={layers.panelGlow} labels={hardwareLabels} />
      {layers.footprint && (
        <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
          <ringGeometry args={[footprint - 0.06, footprint + 0.06, 64]} />
          <meshBasicMaterial color={statusColour(deployment)} transparent opacity={0.85} />
        </mesh>
      )}
      {layers.ramp && hardware.rampHeadingBodyDeg !== undefined && (
        <Ramp headingBodyDeg={hardware.rampHeadingBodyDeg} status={deployment} terrain={terrain} site={site} yawDeg={yawDeg}
          verticalExaggeration={verticalExaggeration} label={hardwareLabels} />
      )}
    </group>
  );
}
