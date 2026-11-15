import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import type { Site, SiteTerrain } from '../contracts';
import type { Vec3 } from '../engine/power';
import { azElToThree } from './frames';
import { Label } from './Label';
import { terrainHeightAt } from './terrainMesh';

const RINGS_M = [10, 25, 50, 100, 150];

/** Distance rings draped on the DEM for scale; segments break where the terrain is unknown or the patch ends. */
export function RangeRings({ terrain, site, verticalExaggeration, labels }: { terrain: SiteTerrain | null; site: Site; verticalExaggeration: number; labels: boolean }) {
  const rings = useMemo(() => RINGS_M.map(r => {
    const runs: Vec3[][] = [];
    let cur: Vec3[] | null = null;
    for (let az = 0; az <= 360; az += 3) {
      const [x, , z] = azElToThree(az, 0).map(v => v * r);
      const h = terrain ? terrainHeightAt(terrain, site, x, -z, verticalExaggeration) : 0;
      if (h === null) { cur = null; continue; }
      if (!cur) runs.push(cur = []);
      cur.push([x, h + 0.08, z]);
    }
    const [lx, , lz] = azElToThree(45, 0).map(v => v * r);
    const lh = terrain ? terrainHeightAt(terrain, site, lx, -lz, verticalExaggeration) : 0;
    return { r, runs: runs.filter(run => run.length > 1), label: lh === null ? null : ([lx, lh + 0.6, lz] as Vec3) };
  }), [terrain, site, verticalExaggeration]);
  return (
    <group name="range-rings">
      {rings.map(({ r, runs, label }) => (
        <group key={r}>
          {runs.map((pts, i) => <Line key={i} points={pts} color="#cfd6df" lineWidth={1} transparent opacity={0.28} />)}
          {labels && label && <Label position={label}>{r} m</Label>}
        </group>
      ))}
    </group>
  );
}
