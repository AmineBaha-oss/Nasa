import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { DoubleSide, LatheGeometry, Quaternion, Shape, Vector2, Vector3, type Group } from 'three';
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
import { foilTexture } from './textures';
import type { SceneLayers } from './types';

const RAMP_PLANK_M = 2.4;
/** Octagon whose flat faces sit at BODY.halfWidthM, so panel standoffs stay outside the body. */
const OCTAGON_R = BODY.halfWidthM / Math.cos(Math.PI / 8);

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

/** Flat plank between two points, used for the ramp. */
function Plank({ from, to, width, colour }: { from: Vec3; to: Vec3; width: number; colour: string }) {
  const a = new Vector3(...from), b = new Vector3(...to), d = b.clone().sub(a);
  const len = d.length();
  if (len < 1e-6) return null;
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), d.clone().normalize());
  return (
    <mesh position={a.add(b).multiplyScalar(0.5).toArray()} quaternion={q} castShadow receiveShadow>
      <boxGeometry args={[width, 0.05, len]} />
      <meshStandardMaterial color={colour} metalness={0.6} roughness={0.4} />
    </mesh>
  );
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
      <Plank from={[d[0] * BODY.halfWidthM, BODY.bottomM + 0.05, d[2] * BODY.halfWidthM]} to={[d[0] * start, foot + 0.05, d[2] * start]} width={0.8} colour="#cfd4db" />
      {runs.filter(r => r.length > 1).map((r, i) => <Line key={i} points={r} color={tone} lineWidth={3.5} dashed dashSize={0.6} gapSize={0.4} />)}
      {label && <Label position={[d[0] * (start + length), (runs.at(-1)?.at(-1)?.[1] ?? 0) + 0.8, d[2] * (start + length)]} tone={tone}>
        Ramp {length} m, deployment {status ?? 'unknown'} (preliminary)
      </Label>}
    </group>
  );
}

/** Descent engine bell under the body. Decorative. */
function EngineBell() {
  const geometry = useMemo(() => {
    const pts = [0.08, 0.1, 0.14, 0.2, 0.27, 0.33].map((r, i) => new Vector2(r, -i * 0.07));
    return new LatheGeometry(pts, 28);
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} position={[0, BODY.bottomM, 0]} castShadow>
      <meshStandardMaterial color="#5b6068" metalness={0.85} roughness={0.35} side={DoubleSide} />
    </mesh>
  );
}

/** Flat arrow on the top deck marking body-forward (three local -z). */
function ForwardArrow() {
  const shape = useMemo(() => {
    const s = new Shape();
    s.moveTo(0, 0.5); s.lineTo(0.28, 0.1); s.lineTo(0.1, 0.1); s.lineTo(0.1, -0.3); s.lineTo(-0.1, -0.3); s.lineTo(-0.1, 0.1); s.lineTo(-0.28, 0.1); s.closePath();
    return s;
  }, []);
  return (
    <mesh position={[0, BODY.topM + 0.05, -0.25]} rotation={[-Math.PI / 2, 0, 0]}>
      <shapeGeometry args={[shape]} />
      <meshStandardMaterial color={PALETTE.signal} emissive={PALETTE.signal} emissiveIntensity={0.6} side={DoubleSide} />
    </mesh>
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
  const legs: Vec3[] = [[1, 0, 1], [1, 0, -1], [-1, 0, 1], [-1, 0, -1]].map(([x, , z]) => [x * Math.SQRT1_2, 0, z * Math.SQRT1_2]);
  const foil = foilTexture();
  const height = BODY.topM - BODY.bottomM;
  return (
    <group ref={group} name="lander">
      <mesh position={[0, (BODY.bottomM + BODY.topM) / 2, 0]} rotation={[0, Math.PI / 8, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[OCTAGON_R, OCTAGON_R, height, 8]} />
        <meshStandardMaterial map={foil} color="#ffffff" metalness={0.75} roughness={0.33} />
      </mesh>
      <mesh position={[0, BODY.topM + 0.025, 0]} rotation={[0, Math.PI / 8, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[OCTAGON_R + 0.05, OCTAGON_R + 0.05, 0.05, 8]} />
        <meshStandardMaterial color={PALETTE.deck} metalness={0.2} roughness={0.55} />
      </mesh>
      <mesh position={[0, BODY.bottomM - 0.02, 0]} rotation={[0, Math.PI / 8, 0]} castShadow>
        <cylinderGeometry args={[OCTAGON_R + 0.03, OCTAGON_R + 0.03, 0.04, 8]} />
        <meshStandardMaterial color="#9da4ad" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[-0.35, BODY.topM + 0.14, 0.3]} castShadow>
        <boxGeometry args={[0.42, 0.18, 0.32]} />
        <meshStandardMaterial color="#d6d9de" metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[0.1, BODY.topM + 0.1, 0.45]} castShadow>
        <cylinderGeometry args={[0.07, 0.07, 0.12, 14]} />
        <meshStandardMaterial color="#2b2f36" metalness={0.5} roughness={0.3} />
      </mesh>
      <EngineBell />
      <ForwardArrow />
      {legs.map(([x, , z], i) => {
        const pad: Vec3 = [x * footprint, 0.05, z * footprint];
        return (
          <group key={i}>
            <Strut from={[x * OCTAGON_R * 0.92, BODY.bottomM + 0.25, z * OCTAGON_R * 0.92]} to={add(pad, [0, 0.06, 0])} radius={0.05} colour="#b6bdc6" />
            <Strut from={[x * OCTAGON_R * 0.6, BODY.bottomM, z * OCTAGON_R * 0.6]} to={lerp3([x * OCTAGON_R * 0.92, BODY.bottomM + 0.25, z * OCTAGON_R * 0.92], pad, 0.55)} radius={0.03} colour="#9aa2ad" />
            <mesh position={pad} castShadow receiveShadow>
              <cylinderGeometry args={[0.2, 0.24, 0.07, 20]} />
              <meshStandardMaterial color="#c4cad2" metalness={0.65} roughness={0.35} />
            </mesh>
          </group>
        );
      })}
      {layers.labels && <Label position={[0, BODY.topM + 0.55, -BODY.halfWidthM - 0.2]} tone={PALETTE.signal}>Forward</Label>}
      <HardwareModel hardware={hardware} readout={readout} earthPoint={earthPoint} yawDeg={yawDeg}
        showBeam={layers.antennaBeam} glow={layers.panelGlow} labels={hardwareLabels} />
      {layers.footprint && (
        <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
          <ringGeometry args={[footprint - 0.05, footprint + 0.05, 72]} />
          <meshBasicMaterial color={statusColour(deployment)} transparent opacity={0.9} />
        </mesh>
      )}
      {layers.ramp && hardware.rampHeadingBodyDeg !== undefined && (
        <Ramp headingBodyDeg={hardware.rampHeadingBodyDeg} status={deployment} terrain={terrain} site={site} yawDeg={yawDeg}
          verticalExaggeration={verticalExaggeration} label={hardwareLabels} />
      )}
    </group>
  );
}

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
