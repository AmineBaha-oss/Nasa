import { useEffect, useLayoutEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { BufferAttribute, BufferGeometry, Color } from 'three';
import type { Site, SiteTerrain } from '../contracts';
import { Label } from './Label';
import { PALETTE } from './palette';
import { buildTerrainMesh } from './terrainMesh';

interface Props {
  terrain: SiteTerrain | null;
  site: Site;
  verticalExaggeration: number;
  slopeColours: boolean;
  slopeLimitDeg: number;
}

/** Deterministic per-vertex brightness jitter so flat regolith reads as a surface; decorative only. */
const jitter = (i: number) => { const s = Math.sin(i * 12.9898) * 43758.5453; return s - Math.floor(s); };

function regolithColour(i: number, heightM: number, out: Color): Color {
  const tint = Math.max(-0.12, Math.min(0.12, heightM / 60));
  return out.set(PALETTE.regolith).multiplyScalar(0.9 + 0.16 * jitter(i) + tint);
}

function slopeColour(slope: number, limit: number, out: Color): Color {
  if (Number.isNaN(slope)) return out.set(PALETTE.unknown).multiplyScalar(0.45);
  if (slope <= limit * 0.5) return out.set(PALETTE.pass);
  if (slope <= limit) return out.set(PALETTE.caution);
  return out.set(PALETTE.fail);
}

/** DEM patch around the lander. Lit by the Sun light but casts no shadows: terrain self-shadowing is not modelled. */
export function Terrain({ terrain, site, verticalExaggeration, slopeColours, slopeLimitDeg }: Props) {
  const mesh = useMemo(
    () => (terrain ? buildTerrainMesh(terrain, site, verticalExaggeration) : { problem: `No terrain patch loaded for ${site.id}` }),
    [terrain, site, verticalExaggeration],
  );
  const geometry = useMemo(() => {
    if ('problem' in mesh) return null;
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(mesh.positions, 3));
    g.setIndex(new BufferAttribute(mesh.indices, 1));
    g.computeVertexNormals();
    return g;
  }, [mesh]);
  useEffect(() => () => geometry?.dispose(), [geometry]);

  const invalidate = useThree(s => s.invalidate);
  useLayoutEffect(() => {
    if (!geometry || 'problem' in mesh) return;
    const colours = new Float32Array(mesh.slopeDeg.length * 3);
    const c = new Color();
    mesh.slopeDeg.forEach((s, i) => (slopeColours ? slopeColour(s, slopeLimitDeg, c) : regolithColour(i, mesh.positions[i * 3 + 1], c)).toArray(colours, i * 3));
    geometry.setAttribute('color', new BufferAttribute(colours, 3));
    invalidate();
  }, [geometry, mesh, slopeColours, slopeLimitDeg, invalidate]);

  if ('problem' in mesh || !geometry) {
    return (
      <group>
        <gridHelper args={[120, 24, PALETTE.unknown, '#2a2f38']} />
        <Label position={[0, 0.5, 8]} tone={PALETTE.unknown}>Terrain unknown: {'problem' in mesh ? mesh.problem : 'no mesh'}</Label>
      </group>
    );
  }
  return (
    <mesh geometry={geometry} receiveShadow name="terrain">
      <meshStandardMaterial vertexColors roughness={1} metalness={0} />
    </mesh>
  );
}
