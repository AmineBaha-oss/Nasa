import { useMemo } from 'react';
import { AdditiveBlending, Color } from 'three';
import { Line } from '@react-three/drei';
import type { Status } from '../contracts';
import type { Vec3 } from '../engine/power';
import { azElToThree } from './frames';
import { Label } from './Label';
import { PALETTE } from './palette';
import type { SampleReadout, TrackPoint } from './readouts';

const DEG = Math.PI / 180;
/** Drawn Sun radius; the real Sun is 0.27 deg and would be a dot. The HUD labels this as exaggerated. */
const SUN_DRAWN_RADIUS_DEG = 0.8;
/** Earth seen from the Moon is about 0.95 deg in radius, so it is drawn at true angular size. */
const EARTH_RADIUS_DEG = 0.95;

const place = (azDeg: number, elDeg: number, r: number): Vec3 => azElToThree(azDeg, elDeg).map(v => v * r) as Vec3;

function trackSegments(points: TrackPoint[], base: string, r: number) {
  const on = new Color(base), off = new Color(base).multiplyScalar(0.28), unknown = new Color(PALETTE.unknown).multiplyScalar(0.6);
  const colourFor = (v: Status) => (v === 'pass' ? on : v === 'fail' ? off : unknown);
  const segments: { points: Vec3[]; colours: [number, number, number][] }[] = [];
  let cur: { points: Vec3[]; colours: [number, number, number][] } | null = null;
  for (const p of points) {
    if (p.azDeg === null || p.elDeg === null) { cur = null; continue; }
    if (!cur) segments.push(cur = { points: [], colours: [] });
    cur.points.push(place(p.azDeg, p.elDeg, r));
    const c = colourFor(p.visible);
    cur.colours.push([c.r, c.g, c.b]);
  }
  return segments.filter(s => s.points.length > 1);
}

interface Props {
  sunTrack: TrackPoint[];
  earthTrack: TrackPoint[];
  sampleIndex: number;
  readout: SampleReadout | null;
  radiusM: number;
  showSunPath: boolean;
  showEarthPath: boolean;
  labels: boolean;
}

export function Sky({ sunTrack, earthTrack, sampleIndex, readout, radiusM, showSunPath, showEarthPath, labels }: Props) {
  const sunSegments = useMemo(() => trackSegments(sunTrack, PALETTE.sun, radiusM), [sunTrack, radiusM]);
  const earthSegments = useMemo(() => trackSegments(earthTrack, PALETTE.earth, radiusM), [earthTrack, radiusM]);
  const sun = readout && readout.sun.azDeg !== null && readout.sun.elDeg !== null ? place(readout.sun.azDeg, readout.sun.elDeg, radiusM) : null;
  const e = earthTrack[sampleIndex];
  const earth = e && e.azDeg !== null && e.elDeg !== null ? place(e.azDeg, e.elDeg, radiusM) : null;
  const sunVisible = readout?.sun.visible ?? 'unknown';
  const sunColour = sunVisible === 'pass' ? PALETTE.sun : sunVisible === 'fail' ? '#6b4a1f' : PALETTE.unknown;
  return (
    <group name="sky">
      {showSunPath && sunSegments.map((s, i) => <Line key={`s${i}`} points={s.points} vertexColors={s.colours} lineWidth={2} />)}
      {showEarthPath && earthSegments.map((s, i) => <Line key={`e${i}`} points={s.points} vertexColors={s.colours} lineWidth={2} />)}
      {sun && (
        <group position={sun} name="sun">
          <mesh>
            <sphereGeometry args={[radiusM * Math.tan(SUN_DRAWN_RADIUS_DEG * DEG), 24, 16]} />
            <meshBasicMaterial color={sunColour} toneMapped={false} />
          </mesh>
          <mesh raycast={() => null}>
            <sphereGeometry args={[radiusM * Math.tan(SUN_DRAWN_RADIUS_DEG * 3.5 * DEG), 24, 16]} />
            <meshBasicMaterial color={sunColour} transparent opacity={0.18} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
          </mesh>
        </group>
      )}
      {earth && (
        <mesh position={earth} name="earth">
          <sphereGeometry args={[radiusM * Math.tan(EARTH_RADIUS_DEG * DEG), 24, 16]} />
          <meshBasicMaterial color={PALETTE.earth} toneMapped={false} />
        </mesh>
      )}
      {labels && sun && <Label position={[sun[0], sun[1] + radiusM * 0.03, sun[2]]} tone={sunColour}>Sun {fmtDeg(readout?.sun.elDeg)}</Label>}
      {labels && earth && e && <Label position={[earth[0], earth[1] + radiusM * 0.035, earth[2]]} tone={PALETTE.earth}>Earth {fmtDeg(e.elDeg)}</Label>}
    </group>
  );
}

const fmtDeg = (v: number | null | undefined) => (v === null || v === undefined ? '' : `${v.toFixed(1)}°`);

/**
 * Directional Sun light. Intensity follows the engine's guaranteed visible-disk fraction, so the scene is
 * never brighter than the engine allows; an unknown Sun leaves only the grey fill light.
 * The hemisphere fill keeps grazing-light polar terrain readable; it is not a lighting claim.
 */
export function SunLight({ readout }: { readout: SampleReadout | null }) {
  const s = readout?.sun;
  const dir = s && s.azDeg !== null && s.elDeg !== null ? azElToThree(s.azDeg, s.elDeg) : null;
  const intensity = dir && s ? 3.2 * s.fraction.low : 0;
  const unknown = !s || s.visible === 'unknown';
  return (
    <>
      <hemisphereLight args={[unknown ? '#9aa1ab' : '#b8c7dd', '#2a2620', unknown ? 0.9 : 0.75]} />
      {dir && intensity > 0 && (
        <directionalLight position={[dir[0] * 120, dir[1] * 120, dir[2] * 120]} intensity={intensity} color="#fff4e0"
          castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-14} shadow-camera-right={14}
          shadow-camera-top={14} shadow-camera-bottom={-14} shadow-camera-near={1} shadow-camera-far={260} shadow-bias={-0.0004} />
      )}
    </>
  );
}
