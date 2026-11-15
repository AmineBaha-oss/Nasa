import { useEffect, useRef } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { Plane, Vector3 } from 'three';
import { azElToThree, groundPointToYawDeg } from './frames';
import { PALETTE } from './palette';

const RING_RADIUS_M = 3.4;
const RING_Y = 0.3;
type Controls = { enabled: boolean } | null;

/**
 * World-fixed ring around the lander; dragging it sets the heading (1 degree steps, 15 with Shift).
 * The HUD heading dial is the keyboard equivalent. Orbit controls pause while dragging.
 */
export function HeadingRing({ yawDeg, onYawChange }: { yawDeg: number; onYawChange?: (yawDeg: number) => void }) {
  const controls = useThree(s => s.controls) as unknown as Controls;
  const dragging = useRef(false);
  const plane = useRef(new Plane(new Vector3(0, 1, 0), -RING_Y));
  const hit = useRef(new Vector3());

  const stop = (e?: ThreeEvent<PointerEvent>) => {
    if (!dragging.current) return;
    dragging.current = false;
    if (controls) controls.enabled = true;
    if (e) (e.target as Element).releasePointerCapture?.(e.pointerId);
    document.body.style.cursor = '';
  };
  useEffect(() => () => { if (dragging.current && controls) controls.enabled = true; document.body.style.cursor = ''; }, [controls]);

  const handle = azElToThree(yawDeg, 0).map((v, i) => (i === 1 ? RING_Y : v * RING_RADIUS_M)) as [number, number, number];
  const interactive = onYawChange !== undefined;
  return (
    <group name="heading-ring">
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, RING_Y, 0]} raycast={() => null}>
        <torusGeometry args={[RING_RADIUS_M, 0.045, 8, 96]} />
        <meshBasicMaterial color={PALETTE.signal} transparent opacity={0.75} />
      </mesh>
      <mesh position={handle}>
        <sphereGeometry args={[0.2, 16, 12]} />
        <meshBasicMaterial color={PALETTE.signal} />
      </mesh>
      {interactive && (
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, RING_Y, 0]}
          onPointerOver={() => { if (!dragging.current) document.body.style.cursor = 'grab'; }}
          onPointerOut={() => { if (!dragging.current) document.body.style.cursor = ''; }}
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
          <torusGeometry args={[RING_RADIUS_M, 0.45, 8, 64]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}
