import { createContext, useContext, type ReactNode, type RefObject } from 'react';
import { Html } from '@react-three/drei';
import type { Vec3 } from '../engine/power';

/** DOM layer over the canvas. Html must portal into it: with fiber 9.8 / drei 10.7 an Html mounted with the Canvas renders empty otherwise. */
export const OverlayContext = createContext<RefObject<HTMLDivElement> | null>(null);

export function Label({ position, children, tone }: { position: Vec3; children: ReactNode; tone?: string }) {
  const overlay = useContext(OverlayContext);
  if (!overlay) return null;
  return (
    <Html portal={overlay} position={position} center zIndexRange={[20, 0]}>
      <div className="lp3d-label" style={tone ? { borderColor: tone, color: tone } : undefined}>{children}</div>
    </Html>
  );
}
