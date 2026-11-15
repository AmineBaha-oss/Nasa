import { useEffect, useRef, type ComponentRef } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { Vec3 } from '../engine/power';
import { azElToThree } from './frames';
import type { CameraMode } from './types';

interface Props { mode: CameraMode; yawDeg: number; eyeHeightM: number; reducedMotion: boolean }

/** Camera pose per mode. Lander mode looks around from just above the mast toward body-forward. */
function pose(mode: CameraMode, yawDeg: number, eyeHeightM: number): { position: Vec3; target: Vec3 } {
  switch (mode) {
    case 'orbit': return { position: [11, 6.5, 13], target: [0, 1.4, 0] };
    case 'top': return { position: [0, 140, 0.01], target: [0, 0, 0] };
    case 'hardware': {
      const [x, , z] = azElToThree(yawDeg + 35, 0);
      return { position: [x * 8, 4.2, z * 8], target: [0, 1.9, 0] };
    }
    case 'lander': {
      const [x, , z] = azElToThree(yawDeg, 0);
      const eye: Vec3 = [-x * 0.6, eyeHeightM, -z * 0.6];
      return { position: eye, target: [eye[0] + x * 0.05, eye[1] - 0.004, eye[2] + z * 0.05] };
    }
    default: { const never: never = mode; return never; }
  }
}

export function CameraRig({ mode, yawDeg, eyeHeightM, reducedMotion }: Props) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const camera = useThree(s => s.camera);
  const invalidate = useThree(s => s.invalidate);
  const followYaw = mode === 'lander' ? yawDeg : 0;
  useEffect(() => {
    const c = controls.current;
    const p = pose(mode, followYaw, eyeHeightM);
    camera.position.set(...p.position);
    c?.target.set(...p.target);
    c?.update();
    invalidate();
  }, [mode, followYaw, eyeHeightM, camera, invalidate]);
  return (
    <OrbitControls ref={controls} makeDefault enableDamping
      enableRotate={mode !== 'top'} enablePan={mode === 'orbit' || mode === 'top'} enableZoom={mode !== 'lander'}
      minDistance={mode === 'lander' ? 0.01 : 2.5} maxDistance={mode === 'lander' ? 0.06 : mode === 'hardware' ? 18 : mode === 'top' ? 400 : 250}
      maxPolarAngle={mode === 'top' ? 0.0001 : mode === 'lander' ? Math.PI * 0.75 : Math.PI * 0.48}
      autoRotate={mode === 'hardware' && !reducedMotion} autoRotateSpeed={0.7} />
  );
}
