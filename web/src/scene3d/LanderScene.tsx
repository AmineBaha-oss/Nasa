import { Canvas, useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import type { LanderSceneProps } from './types';
import { yawToRotationY } from './frames';

/** Stub scene until Person A lands the full mesh. Props and Canvas ownership match docs/3D_PLAN.md. */
function SceneContents({ yawDeg, layers, sampleIndex, hardware, cameraMode }: Pick<LanderSceneProps, 'yawDeg' | 'layers' | 'hardware' | 'data' | 'sampleIndex' | 'cameraMode'>) {
  const invalidate = useThree(s => s.invalidate);
  useEffect(() => { invalidate(); }, [yawDeg, sampleIndex, hardware, layers, cameraMode, invalidate]);
  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight position={[8, 12, 4]} intensity={1.4} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <circleGeometry args={[40, 64]} />
        <meshStandardMaterial color="#3a3f48" />
      </mesh>
      {layers.terrain && (
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[38, 40, 64]} />
          <meshStandardMaterial color="#5a5044" />
        </mesh>
      )}
      <group rotation={[0, yawToRotationY(yawDeg), 0]}>
        <mesh position={[0, 0.6, 0]} castShadow>
          <boxGeometry args={[1.4, 1.2, 1.4]} />
          <meshStandardMaterial color="#c9d0da" />
        </mesh>
        <mesh position={[0, 0.6, -0.85]}>
          <boxGeometry args={[0.2, 0.2, 0.3]} />
          <meshStandardMaterial color="#e85d04" />
        </mesh>
      </group>
      <gridHelper args={[80, 40, '#6b7280', '#374151']} position={[0, 0.02, 0]} />
    </>
  );
}

export default function LanderScene(props: LanderSceneProps) {
  const { reducedMotion } = props;
  return (
    <Canvas
      frameloop={reducedMotion ? 'never' : 'demand'}
      dpr={[1, 2]}
      shadows="percentage"
      camera={{ position: [18, 14, 18], fov: 42, near: 0.1, far: 500 }}
      style={{ width: '100%', height: '100%', background: '#0b1220' }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl, invalidate }) => {
        gl.setClearColor('#0b1220');
        invalidate();
      }}
    >
      <SceneContents {...props} />
    </Canvas>
  );
}
