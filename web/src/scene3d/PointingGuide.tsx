import { createContext, useContext } from 'react';
import { Billboard, Line } from '@react-three/drei';
import { Quaternion, Vector3 } from 'three';
import type { Status } from '../contracts';
import type { Vec3 } from '../engine/power';
import { PALETTE, statusColour } from './palette';
import { directionArc } from './pointingGeometry';

export const GuidanceContext = createContext<{
  active: string | null; selected: string | null;
  select: (id: string | null) => void; hover: (id: string | null) => void;
}>({ active: null, selected: null, select: () => {}, hover: () => {} });
export const useGuidance = () => useContext(GuidanceContext);
const along = (v: Vec3, r: number): Vec3 => new Vector3(...v).normalize().multiplyScalar(r).toArray();

/** Screen-facing symbols carry meaning independently of colour. */
export function TargetGlyph({ kind, colour, size = 0.15, opacity = 1 }: { kind: 'sun' | 'earth' | 'blocked' | 'miss' | 'unknown'; colour: string; size?: number; opacity?: number }) {
  const line = (points: Vec3[], key: number) => <Line key={key} points={points} color={colour} lineWidth={1.8} transparent opacity={opacity} depthTest={false} raycast={() => null} />;
  const ring = Array.from({ length: 33 }, (_, i): Vec3 => [Math.cos(i * Math.PI / 16) * size, Math.sin(i * Math.PI / 16) * size, 0]);
  return <Billboard>
    {(kind === 'sun' || kind === 'earth') && line(ring, 0)}
    {kind === 'sun' && Array.from({ length: 8 }, (_, i) => {
      const a = i * Math.PI / 4;
      return line([[Math.cos(a) * size * 1.35, Math.sin(a) * size * 1.35, 0], [Math.cos(a) * size * 1.8, Math.sin(a) * size * 1.8, 0]], i + 1);
    })}
    {kind === 'earth' && <>{line([[-size, 0, 0], [size, 0, 0]], 1)}{line(ring.map(([x, y, z]) => [x * 0.45, y, z]), 2)}</>}
    {kind === 'miss' && <>{line([[-size, -size, 0], [size, size, 0]], 1)}{line([[-size, size, 0], [size, -size, 0]], 2)}</>}
    {kind === 'blocked' && <>{line([[-size, -size, 0], [-size, size, 0], [size, size, 0], [size, -size, 0], [-size, -size, 0]], 1)}{line([[-size * 1.4, -size * 1.4, 0], [size * 1.4, size * 1.4, 0]], 2)}</>}
    {kind === 'unknown' && <Line points={ring} color={colour} dashed dashSize={size * 0.2} gapSize={size * 0.3} lineWidth={1.8} transparent opacity={opacity} depthTest={false} raycast={() => null} />}
  </Billboard>;
}

interface Props {
  origin: Vec3; aim: Vec3; target: Vec3 | null; kind: 'sun' | 'earth';
  visibility: Status; pointing: Status; limited?: boolean; focused: boolean; muted: boolean;
  showTarget?: boolean;
}

export function PointingGuide({ origin, aim, target, kind, visibility, pointing, limited = false, focused, muted, showTarget = true }: Props) {
  const colour = kind === 'sun' ? PALETTE.sun : PALETTE.earth;
  const opacity = muted ? 0.12 : focused ? 1 : 0.5;
  const blocked = visibility === 'fail';
  const failed = blocked || pointing === 'fail';
  const unknown = !target || visibility === 'unknown' || pointing === 'unknown';
  const tone = failed ? PALETTE.fail : unknown ? PALETTE.unknown : limited ? PALETTE.caution : PALETTE.pass;
  const rotation = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), new Vector3(...aim).normalize());
  const arc = target && focused && new Vector3(...aim).normalize().distanceTo(new Vector3(...target).normalize()) > 1e-4
    ? directionArc(aim, target, 1.3) : [];
  const path = (start: number, end: number) => <Line points={[along(target!, start), along(target!, end)]}
    color={tone} lineWidth={focused ? 2 : 1.2} dashed={unknown} dashSize={0.035} gapSize={0.09}
    transparent opacity={opacity} raycast={() => null} />;
  return <group position={origin} name={`${kind}-pointing-guide`}>
    <Line points={[along(aim, 0.12), along(aim, 1.05)]} color={colour} lineWidth={focused ? 3 : 2} transparent opacity={opacity} raycast={() => null} />
    <mesh position={along(aim, 1.14)} quaternion={rotation} raycast={() => null}>
      <coneGeometry args={[0.065, 0.18, 12]} /><meshBasicMaterial color={colour} transparent opacity={opacity} />
    </mesh>
    {showTarget && (target ? <>
      {failed ? <>{path(0.15, 1.45)}{path(1.85, 2.65)}<group position={along(target, 1.65)}><TargetGlyph kind={blocked ? 'blocked' : 'miss'} colour={tone} opacity={opacity} size={0.11} /></group></> : path(0.15, 2.65)}
      <group position={along(target, 2.8)}><TargetGlyph kind={kind} colour={colour} opacity={opacity} />
        {!failed && !unknown && <Billboard><mesh raycast={() => null}><ringGeometry args={[0.31, 0.33, 40]} /><meshBasicMaterial color={tone} transparent opacity={opacity} depthTest={false} /></mesh></Billboard>}
      </group>
      {arc.length > 1 && <Line points={arc} color={limited ? PALETTE.caution : statusColour(pointing)} lineWidth={2}
        dashed={pointing === 'unknown'} dashSize={0.04} gapSize={0.07} transparent opacity={0.9} raycast={() => null} />}
    </> : <group position={along(aim, 1.55)}><TargetGlyph kind="unknown" colour={PALETTE.unknown} opacity={opacity} /></group>)}
  </group>;
}
