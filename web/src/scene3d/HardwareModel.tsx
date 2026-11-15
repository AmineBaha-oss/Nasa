import { DoubleSide, Quaternion, Vector3 } from 'three';
import { Line } from '@react-three/drei';
import type { HardwareConfig } from '../contracts';
import type { Interval, Vec3 } from '../engine/power';
import { azElToThree, bodyToLocal, enuToThree, threeToLocal } from './frames';
import { ANTENNA_MAST, BODY, gimbalPatch, panelLayout, type PanelLayout } from './hardwareLayout';
import { Label } from './Label';
import { PALETTE, statusColour } from './palette';
import type { PanelReadout, SampleReadout, TrackPoint } from './readouts';

/** Short dashed pointer from the dish toward Earth; Earth itself sits on the sky dome. */
const EARTH_POINTER_M = 10;
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);
const quatFrom = (from: Vector3, to: Vec3) => new Quaternion().setFromUnitVectors(from, new Vector3(...to).normalize());
const scale = (v: Vec3, k: number): Vec3 => [v[0] * k, v[1] * k, v[2] * k];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

export function Strut({ from, to, radius = 0.04, colour = '#b9c0c9' }: { from: Vec3; to: Vec3; radius?: number; colour?: string }) {
  const a = new Vector3(...from), b = new Vector3(...to), d = b.clone().sub(a);
  if (d.length() < 1e-6) return null;
  return (
    <mesh position={a.add(b).multiplyScalar(0.5).toArray()} quaternion={new Quaternion().setFromUnitVectors(Y, d.clone().normalize())} castShadow>
      <cylinderGeometry args={[radius, radius, d.length(), 10]} />
      <meshStandardMaterial color={colour} metalness={0.6} roughness={0.45} />
    </mesh>
  );
}

/** Open cone with its apex at the origin, opening along local +y. */
function Cone({ halfAngleDeg, lengthM, colour, opacity, wireframe = false }: { halfAngleDeg: number; lengthM: number; colour: string; opacity: number; wireframe?: boolean }) {
  return (
    <mesh rotation={[Math.PI, 0, 0]} position={[0, lengthM / 2, 0]} raycast={() => null}>
      <coneGeometry args={[lengthM * Math.tan(halfAngleDeg * Math.PI / 180), lengthM, 40, 1, true]} />
      <meshBasicMaterial color={colour} transparent opacity={opacity} depthWrite={false} side={DoubleSide} wireframe={wireframe} />
    </mesh>
  );
}

const fmtW = (w: Interval) => (Math.abs(w.high - w.low) < 0.05 ? `${w.low.toFixed(0)} W` : `${w.low.toFixed(0)}–${w.high.toFixed(0)} W`);

interface PanelProps {
  layout: PanelLayout;
  readout: PanelReadout | undefined;
  fraction: Interval;
  peakW: number;
  yawDeg: number;
  glow: boolean;
  label: boolean;
}

function PanelModel({ layout, readout, fraction, peakW, yawDeg, glow, label }: PanelProps) {
  const areaFraction = layout.areaFraction;
  const incidence = readout?.incidence ?? null;
  const tracked = layout.mode === 'tracked';
  const normal = tracked && readout?.pointingEnu ? threeToLocal(enuToThree(readout.pointingEnu), yawDeg) : layout.restNormal;
  const clamped = tracked && (readout?.clamped ?? false);
  const strength = incidence === null ? 0 : incidence * fraction.low;
  const watts = incidence === null ? null : { low: peakW * areaFraction * incidence * fraction.low, high: peakW * areaFraction * incidence * fraction.high };
  const mast: Vec3 = [layout.centre[0], BODY.topM, layout.centre[2]];
  return (
    <group name={`panel-${layout.name}`}>
      {tracked
        ? <Strut from={mast} to={add(layout.centre, [0, -0.06, 0])} radius={0.05} />
        : <Strut from={[layout.centre[0] * 0.9, BODY.topM - 0.05, layout.centre[2] * 0.9]} to={add(layout.centre, [0, -layout.sideM / 2, 0])} radius={0.03} />}
      <mesh position={add(layout.centre, tracked ? scale(new Vector3(...normal).normalize().toArray() as Vec3, 0.08) : [0, 0, 0])}
        quaternion={quatFrom(Z, normal)} castShadow>
        <boxGeometry args={[layout.sideM, layout.sideM, 0.04]} />
        <meshStandardMaterial color={incidence === null ? '#59606b' : PALETTE.panel} metalness={0.3} roughness={0.35}
          emissive={PALETTE.sun} emissiveIntensity={glow ? 0.55 * strength : 0} />
      </mesh>
      {tracked && (
        <mesh position={layout.centre}>
          <sphereGeometry args={[0.09, 12, 8]} />
          <meshStandardMaterial color={clamped ? PALETTE.caution : '#cfd6df'} />
        </mesh>
      )}
      {tracked && layout.maxTrackingAngleDeg !== null && layout.maxTrackingAngleDeg < 89 && (
        <group position={layout.centre} quaternion={quatFrom(Y, layout.restNormal)}>
          <Cone halfAngleDeg={layout.maxTrackingAngleDeg} lengthM={1.1} colour={clamped ? PALETTE.caution : '#8fa6c8'} opacity={0.35} wireframe />
        </group>
      )}
      {label && (
        <Label position={tracked ? add(layout.centre, [0, layout.sideM / 2 + 0.5, 0])
          : add(layout.centre, [layout.restNormal[0] * 1.1, layout.sideM / 2 + 0.15, layout.restNormal[2] * 1.1])}
          tone={clamped ? PALETTE.caution : undefined}>
          {layout.name} {layout.areaM2.toFixed(2)} m² · {watts ? fmtW(watts) : 'W unknown'}
          {tracked && (layout.maxTrackingAngleDeg === null ? ' · upper bound' : ` · limit ${layout.maxTrackingAngleDeg}°${clamped ? ' reached' : ''}`)}
        </Label>
      )}
    </group>
  );
}

interface AntennaProps {
  hardware: HardwareConfig;
  readout: SampleReadout | null;
  earthPoint: TrackPoint | undefined;
  yawDeg: number;
  showBeam: boolean;
  label: boolean;
}

function AntennaModel({ hardware, readout, earthPoint, yawDeg, showBeam, label }: AntennaProps) {
  const { antenna, antennaHeightM } = hardware;
  const dish: Vec3 = [ANTENNA_MAST[0], antennaHeightM, ANTENNA_MAST[2]];
  const rest = bodyToLocal(antenna.boresightBodyRFU);
  const earth = readout?.earth ?? null;
  const earthLocal = earthPoint && earthPoint.azDeg !== null && earthPoint.elDeg !== null
    ? threeToLocal(azElToThree(earthPoint.azDeg, earthPoint.elDeg), yawDeg) : null;
  const aim = antenna.gimbal && earth?.pointing === 'pass' && earthLocal ? earthLocal : rest;
  const tone = statusColour(earth?.status);
  const patch = antenna.gimbal ? gimbalPatch(antenna.gimbal) : null;
  return (
    <group name="antenna">
      <Strut from={[dish[0], BODY.topM, dish[2]]} to={dish} radius={0.04} />
      <group position={dish} quaternion={quatFrom(Y, aim)}>
        <mesh position={[0, 0.42, 0]} castShadow>
          <sphereGeometry args={[0.42, 24, 8, 0, Math.PI * 2, Math.PI - 0.9, 0.9]} />
          <meshStandardMaterial color="#e6e9ee" metalness={0.4} roughness={0.4} side={DoubleSide} />
        </mesh>
        {showBeam && <Cone halfAngleDeg={antenna.beamHalfAngleDeg} lengthM={6} colour={tone} opacity={0.12} />}
      </group>
      {showBeam && label && patch && (
        <mesh position={dish} raycast={() => null}>
          <sphereGeometry args={[1.1, 24, 10, patch.phiStart, patch.phiLength, patch.thetaStart, patch.thetaLength]} />
          <meshBasicMaterial color="#8fa6c8" wireframe transparent opacity={0.12} depthWrite={false} />
        </mesh>
      )}
      {showBeam && earthLocal && earth && (
        <Line points={[dish, add(dish, scale(earthLocal, EARTH_POINTER_M))]} color={tone} lineWidth={2} dashed dashSize={0.5} gapSize={0.35} transparent opacity={0.9} />
      )}
      {label && (
        <Label position={add(dish, [0, 0.9, 0])} tone={tone}>
          Antenna ±{antenna.beamHalfAngleDeg}°{antenna.gimbal ? ' gimbal' : ' fixed'}
          {' · Earth '}{earth ? (earth.status === 'pass' ? 'reachable' : earth.status === 'fail' ? 'not reachable' : 'unknown') : 'unknown'}
        </Label>
      )}
    </group>
  );
}

interface Props {
  hardware: HardwareConfig;
  readout: SampleReadout | null;
  earthPoint: TrackPoint | undefined;
  yawDeg: number;
  showBeam: boolean;
  glow: boolean;
  labels: boolean;
}

/** Panels and antenna drawn from the HardwareConfig only; preset names are never used to choose geometry. */
export function HardwareModel({ hardware, readout, earthPoint, yawDeg, showBeam, glow, labels }: Props) {
  const layout = panelLayout(hardware);
  const fraction = readout?.sun.fraction ?? { low: 0, high: 1 };
  return (
    <group name="hardware">
      {layout.map(l => (
        <PanelModel key={`${hardware.name}-${l.index}`} layout={l} readout={readout?.panels[l.index]}
          fraction={fraction} peakW={hardware.peakSolarPowerW} yawDeg={yawDeg} glow={glow} label={labels} />
      ))}
      <AntennaModel hardware={hardware} readout={readout} earthPoint={earthPoint} yawDeg={yawDeg} showBeam={showBeam} label={labels} />
    </group>
  );
}
