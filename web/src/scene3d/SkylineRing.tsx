import { useEffect, useMemo } from 'react';
import { BufferAttribute, BufferGeometry, Color, DoubleSide } from 'three';
import { Line } from '@react-three/drei';
import type { HorizonProfile } from '../contracts';
import { Label } from './Label';
import { PALETTE } from './palette';
import { buildSkyline, skylineWall } from './skyline';

interface Props {
  horizon: HorizonProfile;
  eyeHeightM: number;
  radiusM: number;
  floorY: number;
  colour: string;
  /** Silhouette wall below the line; only the Sun-horizon ring gets one. */
  wall: boolean;
  label?: string;
}

/** Angular skyline ring: correct as seen from the lander eye, not drawn at the terrain's real distance. */
export function SkylineRing({ horizon, eyeHeightM, radiusM, floorY, colour, wall, label }: Props) {
  const sky = useMemo(() => buildSkyline(horizon, radiusM, eyeHeightM), [horizon, radiusM, eyeHeightM]);
  const geometry = useMemo(() => {
    if ('problem' in sky || !wall) return null;
    const w = skylineWall(sky, floorY);
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(w.positions, 3));
    const colours = new Float32Array(w.positions.length);
    const top = new Color(PALETTE.wallTop), bottom = new Color(PALETTE.space);
    for (let v = 0; v < w.positions.length / 3; v++) (v % 2 === 0 ? bottom : top).toArray(colours, v * 3);
    g.setAttribute('color', new BufferAttribute(colours, 3));
    g.setIndex(new BufferAttribute(w.indices, 1));
    return g;
  }, [sky, wall, floorY]);
  useEffect(() => () => geometry?.dispose(), [geometry]);

  if ('problem' in sky) {
    return <Label position={[0, eyeHeightM + 20, -radiusM * 0.5]} tone={PALETTE.unknown}>Skyline unknown: {sky.problem}</Label>;
  }
  return (
    <group name={label ?? 'skyline'}>
      {geometry && (
        <mesh geometry={geometry} raycast={() => null}>
          <meshBasicMaterial vertexColors side={DoubleSide} fog={false} />
        </mesh>
      )}
      {sky.runs.map((run, i) => {
        const pts = run.points.map(p => p.position);
        return <Line key={i} points={run.closed ? [...pts, pts[0]] : pts} color={colour} lineWidth={1.6} transparent opacity={0.9} fog={false} />;
      })}
    </group>
  );
}
