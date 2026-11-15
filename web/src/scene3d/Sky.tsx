import { useMemo } from 'react';
import { AdditiveBlending, CanvasTexture, Color, SRGBColorSpace, type Texture } from 'three';
import { Billboard, Line, Stars } from '@react-three/drei';
import type { Status } from '../contracts';
import type { Vec3 } from '../engine/power';
import { azElToThree } from './frames';
import { Label } from './Label';
import { PALETTE } from './palette';
import type { SampleReadout, TrackPoint } from './readouts';

const DEG = Math.PI / 180;
/** Drawn Sun radius; the real Sun is 0.27 deg and would be a dot. The HUD labels this as exaggerated. */
const SUN_DRAWN_RADIUS_DEG = 0.9;
/** Earth seen from the Moon is about 0.95 deg in radius, so it is drawn at true angular size. */
const EARTH_RADIUS_DEG = 0.95;

const place = (azDeg: number, elDeg: number, r: number): Vec3 => azElToThree(azDeg, elDeg).map(v => v * r) as Vec3;

let glowTexture: Texture | null = null;
/** Soft radial falloff shared by the Sun halo and the panel glints. */
export function radialGlow(): Texture {
  if (glowTexture) return glowTexture;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.18, 'rgba(255,255,255,.55)');
    g.addColorStop(0.45, 'rgba(255,255,255,.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  glowTexture = new CanvasTexture(canvas);
  glowTexture.colorSpace = SRGBColorSpace;
  return glowTexture;
}

function trackSegments(points: TrackPoint[], base: string, r: number) {
  const on = new Color(base), off = new Color(base).multiplyScalar(0.3), unknown = new Color(PALETTE.unknown).multiplyScalar(0.6);
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
  const sunColour = sunVisible === 'pass' ? PALETTE.sunLight : sunVisible === 'fail' ? '#7a5426' : PALETTE.unknown;
  const sunR = radiusM * Math.tan(SUN_DRAWN_RADIUS_DEG * DEG);
  const earthR = radiusM * Math.tan(EARTH_RADIUS_DEG * DEG);
  return (
    <group name="sky">
      <Stars radius={radiusM * 1.6} depth={radiusM * 0.6} count={3500} factor={10} saturation={0} fade speed={0} />
      {showSunPath && sunSegments.map((s, i) => <Line key={`s${i}`} points={s.points} vertexColors={s.colours} lineWidth={2} fog={false} />)}
      {showEarthPath && earthSegments.map((s, i) => <Line key={`e${i}`} points={s.points} vertexColors={s.colours} lineWidth={2} fog={false} />)}
      {sun && (
        <group position={sun} name="sun">
          <mesh>
            <sphereGeometry args={[sunR, 32, 16]} />
            <meshBasicMaterial color={sunColour} toneMapped={false} fog={false} />
          </mesh>
          <Billboard>
            <mesh raycast={() => null}>
              <planeGeometry args={[sunR * 14, sunR * 14]} />
              <meshBasicMaterial map={radialGlow()} color={sunVisible === 'pass' ? PALETTE.sun : sunColour} transparent opacity={sunVisible === 'pass' ? 0.9 : 0.35}
                depthWrite={false} blending={AdditiveBlending} toneMapped={false} fog={false} />
            </mesh>
          </Billboard>
        </group>
      )}
      {earth && (
        <group position={earth} name="earth">
          <mesh>
            <sphereGeometry args={[earthR, 32, 16]} />
            <meshBasicMaterial color={PALETTE.earth} toneMapped={false} fog={false} />
          </mesh>
          <Billboard>
            <mesh raycast={() => null}>
              <planeGeometry args={[earthR * 5, earthR * 5]} />
              <meshBasicMaterial map={radialGlow()} color={PALETTE.earth} transparent opacity={0.45} depthWrite={false} blending={AdditiveBlending} toneMapped={false} fog={false} />
            </mesh>
          </Billboard>
        </group>
      )}
      {labels && sun && <Label position={[sun[0], sun[1] + sunR * 4, sun[2]]} tone={PALETTE.sun}>Sun {fmtDeg(readout?.sun.elDeg)}</Label>}
      {labels && earth && e && <Label position={[earth[0], earth[1] + earthR * 3, earth[2]]} tone={PALETTE.earth}>Earth {fmtDeg(e.elDeg)}</Label>}
    </group>
  );
}

const fmtDeg = (v: number | null | undefined) => (v === null || v === undefined ? '' : `${v.toFixed(1)}°`);

/**
 * Lighting rig. The key light is the Sun: direction from the ephemeris, intensity scaled by the engine's
 * guaranteed visible-disk fraction, so it is never brighter than the engine allows and is off when the Sun is hidden.
 * The cool fill and sky light are display aids so grazing polar light stays readable; the HUD says so.
 */
export function SunLight({ readout }: { readout: SampleReadout | null }) {
  const s = readout?.sun;
  const dir = s && s.azDeg !== null && s.elDeg !== null ? azElToThree(s.azDeg, s.elDeg) : null;
  const intensity = dir && s ? 3.2 * s.fraction.low : 0;
  const unknown = !s || s.visible === 'unknown';
  const fillAz = s?.azDeg !== null && s?.azDeg !== undefined ? s.azDeg + 180 : 200;
  const fill = azElToThree(fillAz, 35);
  return (
    <>
      <hemisphereLight args={['#cbd3df', '#50483d', unknown ? 1.0 : 0.85]} />
      {!unknown && <directionalLight position={[fill[0] * 80, fill[1] * 80, fill[2] * 80]} intensity={0.4} color={PALETTE.fill} />}
      {dir && intensity > 0 && (
        <directionalLight position={[dir[0] * 120, dir[1] * 120, dir[2] * 120]} intensity={intensity} color={PALETTE.sunLight}
          castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-30} shadow-camera-right={30}
          shadow-camera-top={20} shadow-camera-bottom={-20} shadow-camera-near={1} shadow-camera-far={300}
          shadow-bias={-0.0003} shadow-normalBias={0.04} />
      )}
    </>
  );
}
