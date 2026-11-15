import { Line } from '@react-three/drei';
import type { HorizonProfile, Status } from '../contracts';
import { obstructionGeometry } from './pointingGeometry';
import { TargetGlyph, useGuidance } from './PointingGuide';
import { PALETTE } from './palette';

export function ObstructionMarker({ horizon, visible, az, el, eye, radius, kind }: {
  horizon: HorizonProfile; visible: Status; az: number | null; el: number | null;
  eye: number; radius: number; kind: 'sun' | 'earth';
}) {
  const { active } = useGuidance();
  const geometry = obstructionGeometry(horizon, visible, az, el, eye, radius);
  if (!geometry) return null;
  const focused = kind === 'sun' ? active?.startsWith('panel-') : active === 'antenna';
  if (active && !focused) return null;
  const colour = kind === 'sun' ? PALETTE.sun : PALETTE.earth;
  return <group name={`${kind}-skyline-obstruction`}>
    <Line points={geometry.edge} color={PALETTE.fail} lineWidth={focused ? 5 : 3} depthTest={false} raycast={() => null} fog={false} />
    <Line points={[geometry.top, geometry.target]} color={PALETTE.fail} lineWidth={2} dashed dashSize={2} gapSize={2} depthTest={false} raycast={() => null} fog={false} />
    <group position={geometry.top}><TargetGlyph kind="blocked" colour={PALETTE.fail} size={5} /></group>
    <group position={geometry.target}><TargetGlyph kind={kind} colour={colour} size={3} /></group>
  </group>;
}
