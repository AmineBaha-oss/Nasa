import { useMemo, useState } from 'react';
import { AdditiveBlending, DoubleSide, LatheGeometry, Quaternion, Vector2, Vector3 } from 'three';
import { Billboard, Line } from '@react-three/drei';
import type { HardwareConfig, Status } from '../contracts';
import type { Interval, Vec3 } from '../engine/power';
import { azElToThree, bodyToLocal, enuToThree, threeToLocal } from './frames';
import { ANTENNA_MAST, BODY, PANEL_THICKNESS_M, gimbalPatch, panelLayout, trackerAngles, type PanelLayout } from './hardwareLayout';
import { Label } from './Label';
import { PALETTE, statusColour } from './palette';
import type { PanelReadout, SampleReadout, TrackPoint } from './readouts';
import { radialGlow } from './Sky';
import { solarCellTexture } from './textures';
import { PointingGuide, useGuidance } from './PointingGuide';

const DISH_RADIUS_M = 0.45;
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);
const quatFrom = (from: Vector3, to: Vec3) => new Quaternion().setFromUnitVectors(from, new Vector3(...to).normalize());
const scale = (v: Vec3, k: number): Vec3 => [v[0] * k, v[1] * k, v[2] * k];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const unit = (v: Vec3): Vec3 => { const n = Math.hypot(...v) || 1; return [v[0] / n, v[1] / n, v[2] / n]; };

export function Strut({ from, to, radius = 0.04, colour = '#b9c0c9' }: { from: Vec3; to: Vec3; radius?: number; colour?: string }) {
  const a = new Vector3(...from), b = new Vector3(...to), d = b.clone().sub(a);
  if (d.length() < 1e-6) return null;
  return (
    <mesh position={a.add(b).multiplyScalar(0.5).toArray()} quaternion={new Quaternion().setFromUnitVectors(Y, d.clone().normalize())} castShadow>
      <cylinderGeometry args={[radius, radius, d.length(), 12]} />
      <meshStandardMaterial color={colour} metalness={0.7} roughness={0.32} />
    </mesh>
  );
}

/** Open cone with its apex at the origin, opening along local +y, with a rim ring so its edge reads. */
function Cone({ halfAngleDeg, lengthM, colour, opacity, wireframe = false }: { halfAngleDeg: number; lengthM: number; colour: string; opacity: number; wireframe?: boolean }) {
  const r = lengthM * Math.tan(halfAngleDeg * Math.PI / 180);
  if (wireframe) {
    const rim = Array.from({ length: 65 }, (_, i): Vec3 => [Math.cos(i * Math.PI / 32) * r, lengthM, Math.sin(i * Math.PI / 32) * r]);
    return <group raycast={() => null}>
      <Line points={rim} color={colour} lineWidth={1.5} transparent opacity={opacity} raycast={() => null} />
      {[0, 16, 32, 48].map(i => <Line key={i} points={[[0, 0, 0], rim[i]]} color={colour} lineWidth={1} transparent opacity={opacity * 0.6} raycast={() => null} />)}
    </group>;
  }
  return (
    <group raycast={() => null}>
      <mesh rotation={[Math.PI, 0, 0]} position={[0, lengthM / 2, 0]} raycast={() => null}>
        <coneGeometry args={[r, lengthM, 48, 1, true]} />
        <meshBasicMaterial color={colour} transparent opacity={opacity} depthWrite={false} side={DoubleSide} wireframe={wireframe} />
      </mesh>
      {!wireframe && (
        <mesh position={[0, lengthM, 0]} rotation={[Math.PI / 2, 0, 0]} raycast={() => null}>
          <torusGeometry args={[r, 0.015, 6, 64]} />
          <meshBasicMaterial color={colour} transparent opacity={0.35} />
        </mesh>
      )}
    </group>
  );
}

const fmtW = (w: Interval) => (Math.abs(w.high - w.low) < 0.05 ? `${w.low.toFixed(0)} W` : `${w.low.toFixed(0)}–${w.high.toFixed(0)} W`);

function GimbalOutline({ patch, colour }: { patch: ReturnType<typeof gimbalPatch>; colour: string }) {
  const point = (p: number, t: number): Vec3 => [-Math.cos(p) * Math.sin(t) * 1.4, Math.cos(t) * 1.4, Math.sin(p) * Math.sin(t) * 1.4];
  const edges = [0, 1].flatMap(end => [
    Array.from({ length: 49 }, (_, i) => point(patch.phiStart + patch.phiLength * i / 48, patch.thetaStart + patch.thetaLength * end)),
    Array.from({ length: 33 }, (_, i) => point(patch.phiStart + patch.phiLength * end, patch.thetaStart + patch.thetaLength * i / 32)),
  ]);
  return <>{edges.map((points, i) => <Line key={i} points={points} color={colour} lineWidth={1.5} transparent opacity={0.65} raycast={() => null} />)}</>;
}

/** Illustrative pan/tilt cradle: the side bearings stay outside the panel at every tilt. */
function TrackerSupport({ layout, pan }: { layout: PanelLayout; pan: number }) {
  const half = layout.sideM / 2;
  const width = half + 0.14;
  const bottom = -half - 0.2;
  const base = add(layout.centre, [0, bottom - 0.12, 0]);
  return <>
    <Strut from={[-BODY.halfWidthM, base[1], 0]} to={base} radius={0.055} />
    <Strut from={base} to={add(layout.centre, [0, bottom, 0])} radius={0.065} />
    <group position={layout.centre} rotation={[0, pan, 0]}>
      <Strut from={[-width, bottom, 0]} to={[width, bottom, 0]} radius={0.035} />
      {[-1, 1].map(sign => <group key={sign}>
        <Strut from={[sign * width, bottom, 0]} to={[sign * width, 0, 0]} radius={0.035} />
        <Strut from={[sign * width, 0, 0]} to={[sign * half, 0, 0]} radius={0.04} />
      </group>)}
    </group>
  </>;
}

interface PanelProps {
  layout: PanelLayout;
  readout: PanelReadout | undefined;
  fraction: Interval;
  sunLocal: Vec3 | null;
  sunVisible: Status;
  primary: boolean;
  peakW: number;
  yawDeg: number;
  glow: boolean;
  label: boolean;
}

function PanelModel({ layout, readout, fraction, sunLocal, sunVisible, primary, peakW, yawDeg, glow, label }: PanelProps) {
  const [hover, setHover] = useState(false);
  const guidance = useGuidance();
  const id = `panel-${layout.index}`;
  const focused = guidance.active === id;
  const muted = guidance.active !== null && !focused;
  const areaFraction = layout.areaFraction;
  const incidence = readout?.incidence ?? null;
  const tracked = layout.mode === 'tracked';
  const normal = tracked && readout?.pointingEnu ? threeToLocal(enuToThree(readout.pointingEnu), yawDeg) : layout.restNormal;
  const clamped = tracked && (readout?.clamped ?? false);
  const strength = incidence === null ? 0 : incidence * fraction.low;
  const watts = incidence === null ? null : { low: peakW * areaFraction * incidence * fraction.low, high: peakW * areaFraction * incidence * fraction.high };
  const angles = trackerAngles(normal);
  const orientation = tracked
    ? new Quaternion().setFromAxisAngle(Y, angles.pan).multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), angles.tilt))
    : quatFrom(Z, normal);
  const face = layout.centre;
  const cells = solarCellTexture();
  const lit = glow && strength > 0.01 && sunLocal !== null;
  return (
    <group name={`panel-${layout.name}`}>
      {tracked
        ? <TrackerSupport layout={layout} pan={angles.pan} />
        : <Strut from={[layout.centre[0] * 0.9, BODY.topM - 0.05, layout.centre[2] * 0.9]} to={add(layout.centre, [0, -layout.sideM / 2, 0])} radius={0.03} />}
      <mesh position={face} quaternion={orientation} castShadow
        onClick={e => { e.stopPropagation(); guidance.select(guidance.selected === id ? null : id); }}
        onPointerOver={e => { e.stopPropagation(); setHover(true); guidance.hover(id); }}
        onPointerOut={() => { setHover(false); guidance.hover(null); }}>
        <boxGeometry args={[layout.sideM, layout.sideM, PANEL_THICKNESS_M]} />
        <meshStandardMaterial attach="material-0" color={PALETTE.frame} metalness={0.8} roughness={0.3} />
        <meshStandardMaterial attach="material-1" color={PALETTE.frame} metalness={0.8} roughness={0.3} />
        <meshStandardMaterial attach="material-2" color={PALETTE.frame} metalness={0.8} roughness={0.3} />
        <meshStandardMaterial attach="material-3" color={PALETTE.frame} metalness={0.8} roughness={0.3} />
        <meshPhysicalMaterial attach="material-4" map={cells} color={incidence === null ? '#7b818b' : '#ffffff'} metalness={0.2} roughness={0.22}
          clearcoat={1} clearcoatRoughness={0.15} emissive={PALETTE.sun} emissiveIntensity={glow ? 0.35 * strength : 0} />
        <meshStandardMaterial attach="material-5" color="#e9ebee" metalness={0.1} roughness={0.7} />
      </mesh>
      {lit && sunLocal && (
        <>
          <Billboard position={add(face, scale(unit(normal), 0.05))}>
            <mesh raycast={() => null}>
              <planeGeometry args={[layout.sideM * 1.2, layout.sideM * 1.2]} />
              <meshBasicMaterial map={radialGlow()} color={PALETTE.sun} transparent opacity={0.18 * strength} depthWrite={false}
                blending={AdditiveBlending} toneMapped={false} />
            </mesh>
          </Billboard>
        </>
      )}
      {glow && <PointingGuide origin={face} aim={normal} target={sunLocal} kind="sun" visibility={sunVisible}
        pointing={incidence === null ? 'unknown' : incidence <= 0 ? 'fail' : 'pass'} limited={clamped} focused={focused} muted={muted}
        showTarget={!muted && (focused || primary)} />}
      {glow && tracked && focused && layout.maxTrackingAngleDeg !== null && layout.maxTrackingAngleDeg < 89 && (
        <group position={layout.centre} quaternion={quatFrom(Y, layout.restNormal)}>
          <Cone halfAngleDeg={layout.maxTrackingAngleDeg} lengthM={0.65} colour={clamped ? PALETTE.caution : '#8fa6c8'} opacity={0.65} wireframe />
        </group>
      )}
      {((label && focused) || hover) && (
        <Label position={tracked ? add(layout.centre, [0, layout.sideM / 2 + 0.5, 0])
          : add(layout.centre, [layout.restNormal[0] * 1.1, layout.sideM / 2 + 0.15, layout.restNormal[2] * 1.1])}
          tone={clamped ? PALETTE.caution : undefined}>
          {layout.name} {layout.areaM2.toFixed(2)} m², {watts ? fmtW(watts) : 'power unknown'}
          {incidence !== null && `, ${(incidence * 100).toFixed(0)}% facing Sun`}
          {tracked && (layout.maxTrackingAngleDeg === null ? ', upper bound' : `, limit ${layout.maxTrackingAngleDeg}°${clamped ? ' reached' : ''}`)}
        </Label>
      )}
    </group>
  );
}

/** Paraboloid dish opening along +y, focal length chosen for a shallow look. */
function useDishGeometry() {
  return useMemo(() => {
    const f = DISH_RADIUS_M * 0.75, pts: Vector2[] = [];
    for (let i = 0; i <= 16; i++) { const r = (DISH_RADIUS_M * i) / 16; pts.push(new Vector2(r, (r * r) / (4 * f))); }
    return { geometry: new LatheGeometry(pts, 40), focusY: f, rimY: (DISH_RADIUS_M * DISH_RADIUS_M) / (4 * f) };
  }, []);
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
  const [hover, setHover] = useState(false);
  const guidance = useGuidance();
  const focused = guidance.active === 'antenna';
  const muted = guidance.active !== null && !focused;
  const dishGeo = useDishGeometry();
  const { antenna, antennaHeightM } = hardware;
  const dish: Vec3 = [ANTENNA_MAST[0], antennaHeightM, ANTENNA_MAST[2]];
  const rest = bodyToLocal(antenna.boresightBodyRFU);
  const earth = readout?.earth ?? null;
  const earthLocal = earthPoint && earthPoint.azDeg !== null && earthPoint.elDeg !== null
    ? threeToLocal(azElToThree(earthPoint.azDeg, earthPoint.elDeg), yawDeg) : null;
  const aim = antenna.gimbal && earth?.pointing === 'pass' && earthLocal ? earthLocal : rest;
  const tone = statusColour(earth?.status);
  const patch = antenna.gimbal ? gimbalPatch(antenna.gimbal) : null;
  const feedStruts: Vec3[] = [0, 1, 2].map(k => [Math.cos((k * 2 * Math.PI) / 3) * DISH_RADIUS_M * 0.95, dishGeo.rimY, Math.sin((k * 2 * Math.PI) / 3) * DISH_RADIUS_M * 0.95]);
  return (
    <group name="antenna">
      <Strut from={[dish[0], BODY.topM, dish[2]]} to={add(dish, [0, -0.05, 0])} radius={0.045} />
      <mesh position={dish}>
        <sphereGeometry args={[0.07, 16, 10]} />
        <meshStandardMaterial color="#9aa3ae" metalness={0.8} roughness={0.3} />
      </mesh>
      <group position={dish} quaternion={quatFrom(Y, aim)}
        onClick={e => { e.stopPropagation(); guidance.select(guidance.selected === 'antenna' ? null : 'antenna'); }}
        onPointerOver={e => { e.stopPropagation(); setHover(true); guidance.hover('antenna'); }}
        onPointerOut={() => { setHover(false); guidance.hover(null); }}>
        <mesh geometry={dishGeo.geometry} position={[0, 0.06, 0]} castShadow>
          <meshStandardMaterial color="#f1f2f4" metalness={0.15} roughness={0.5} side={DoubleSide} />
        </mesh>
        {feedStruts.map((p, i) => <Strut key={i} from={add(p, [0, 0.06, 0])} to={[0, dishGeo.focusY + 0.06, 0]} radius={0.008} colour="#d0d4da" />)}
        <mesh position={[0, dishGeo.focusY + 0.08, 0]}>
          <cylinderGeometry args={[0.035, 0.05, 0.08, 12]} />
          <meshStandardMaterial color="#c9a24a" metalness={0.7} roughness={0.35} />
        </mesh>
        {showBeam && focused && antenna.beamHalfAngleDeg < 89 && <Cone halfAngleDeg={antenna.beamHalfAngleDeg} lengthM={1.7} colour={PALETTE.earth} opacity={0.05} />}
      </group>
      {showBeam && focused && patch && (
        <group position={dish}><GimbalOutline patch={patch} colour={earth?.pointing === 'fail' ? PALETTE.caution : PALETTE.earth} /></group>
      )}
      {showBeam && <PointingGuide origin={dish} aim={aim} target={earthLocal} kind="earth"
        visibility={earth?.earthVisible ?? 'unknown'} pointing={earth?.pointing ?? 'unknown'} focused={focused} muted={muted} />}
      {((label && focused) || hover) && (
        <Label position={add(dish, [0, 0.9, 0])} tone={tone}>
          Antenna ±{antenna.beamHalfAngleDeg}° {antenna.gimbal ? 'gimballed' : 'fixed'}, Earth {earth ? (earth.status === 'pass' ? 'reachable' : earth.status === 'fail' ? 'not reachable' : 'unknown') : 'unknown'}
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
  const s = readout?.sun;
  // One shared Sun target by default for multi-face arrays; inspect any face to reveal its own gap.
  const primary = layout.reduce((best, p) => (readout?.panels[p.index]?.incidence ?? -1) > (readout?.panels[best]?.incidence ?? -1) ? p.index : best, layout[0]?.index ?? 0);
  const sunLocal = s && s.azDeg !== null && s.elDeg !== null ? threeToLocal(azElToThree(s.azDeg, s.elDeg), yawDeg) : null;
  return (
    <group name="hardware">
      {layout.map(l => (
        <PanelModel key={`${hardware.name}-${l.index}`} layout={l} readout={readout?.panels[l.index]} sunLocal={sunLocal} sunVisible={s?.visible ?? 'unknown'} primary={l.index === primary}
          fraction={fraction} peakW={hardware.peakSolarPowerW} yawDeg={yawDeg} glow={glow} label={labels} />
      ))}
      <AntennaModel hardware={hardware} readout={readout} earthPoint={earthPoint} yawDeg={yawDeg} showBeam={showBeam} label={labels} />
    </group>
  );
}
