import { useEffect, useMemo, useRef, useState } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { BufferGeometry, Float32BufferAttribute, Plane, Vector3 } from 'three';
import { azElToThree, groundPointToYawDeg } from './frames';
import { PALETTE } from './palette';

const RING_RADIUS_M = 3.4;
const RING_Y = 0.3;
type Controls = { enabled: boolean } | null;

/** Tick marks every 15 degrees, longer at the cardinal points. */
function useTicks() {
  const geometry = useMemo(() => {
    const pts: number[] = [];
    for (let az = 0; az < 360; az += 15) {
      const [x, , z] = azElToThree(az, 0);
      const len = az % 90 === 0 ? 0.45 : 0.2;
      pts.push(x * RING_RADIUS_M, RING_Y, z * RING_RADIUS_M, x * (RING_RADIUS_M + len), RING_Y, z * (RING_RADIUS_M + len));
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pts, 3));
    return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/**
 * World-fixed ring around the lander; dragging it sets the heading (1 degree steps, 15 with Shift).
 * The HUD heading dial is the keyboard equivalent. Camera controls pause while dragging.
 */
export function HeadingRing({ yawDeg, onYawChange }: { yawDeg: number; onYawChange?: (yawDeg: number) => void }) {
  const controls = useThree(s => s.controls) as unknown as Controls;
  const invalidate = useThree(s => s.invalidate);
  const dragging = useRef(false);
  const [hot, setHot] = useState(false);
  const plane = useRef(new Plane(new Vector3(0, 1, 0), -RING_Y));
  const hit = useRef(new Vector3());
  const ticks = useTicks();

  const stop = (e?: ThreeEvent<PointerEvent>) => {
    if (!dragging.current) return;
    dragging.current = false;
    if (controls) controls.enabled = true;
    if (e) (e.target as Element).releasePointerCapture?.(e.pointerId);
    document.body.style.cursor = '';
    setHot(false);
  };
  useEffect(() => () => { if (dragging.current && controls) controls.enabled = true; document.body.style.cursor = ''; }, [controls]);
  useEffect(() => { invalidate(); }, [hot, invalidate]);

  const [hx, , hz] = azElToThree(yawDeg, 0);
  const handle: [number, number, number] = [hx * (RING_RADIUS_M + 0.35), RING_Y, hz * (RING_RADIUS_M + 0.35)];
  const interactive = onYawChange !== undefined;
  const colour = hot ? '#ffb08f' : PALETTE.signal;
  return (
    <group name="heading-ring">
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, RING_Y, 0]} raycast={() => null}>
        <torusGeometry args={[RING_RADIUS_M, hot ? 0.07 : 0.045, 8, 128]} />
        <meshBasicMaterial color={colour} transparent opacity={hot ? 0.95 : 0.7} />
      </mesh>
      <lineSegments geometry={ticks} raycast={() => null}>
        <lineBasicMaterial color={colour} transparent opacity={0.8} />
      </lineSegments>
      <group position={handle} rotation={[0, Math.atan2(hx, hz), 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} raycast={() => null}>
          <coneGeometry args={[0.24, 0.55, 20]} />
          <meshBasicMaterial color={colour} />
        </mesh>
      </group>
      {interactive && (
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, RING_Y, 0]}
          onPointerOver={() => { setHot(true); if (!dragging.current) document.body.style.cursor = 'grab'; }}
          onPointerOut={() => { if (!dragging.current) { setHot(false); document.body.style.cursor = ''; } }}
          onPointerDown={e => {
            e.stopPropagation();
            dragging.current = true;
            if (controls) controls.enabled = false;
            (e.target as Element).setPointerCapture?.(e.pointerId);
            document.body.style.cursor = 'grabbing';
          }}
          onPointerMove={e => {
            if (!dragging.current) return;
            const p = e.ray.intersectPlane(plane.current, hit.current);
            if (p) onYawChange(groundPointToYawDeg(p.x, p.z, e.shiftKey ? 15 : 1));
          }}
          onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={() => stop()}>
          <torusGeometry args={[RING_RADIUS_M, 0.5, 8, 64]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}
