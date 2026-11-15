import { useEffect, useLayoutEffect, useMemo } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { BufferAttribute, BufferGeometry, Color, MeshStandardMaterial, ShaderChunk } from 'three';
import type { CameraControls as CameraControlsImpl } from '@react-three/drei';
import type { Site, SiteTerrain } from '../contracts';
import { Label } from './Label';
import { PALETTE } from './palette';
import { buildTerrainMesh } from './terrainMesh';
import { regolithTexture } from './textures';

/** Metres covered by one repeat of the decorative grain texture. */
const GRAIN_TILE_M = 16;
/**
 * Display aid: near-horizontal lights (the polar Sun) light flat ground as if it received this fraction of full sunlight,
 * so the lit side, slopes and the lander's shadow stay readable. Direction still comes from the ephemeris; the HUD discloses it.
 */
const GRAZING_FLAT_LIGHT = 0.15;

interface Props {
  terrain: SiteTerrain | null;
  site: Site;
  verticalExaggeration: number;
  slopeColours: boolean;
  slopeLimitDeg: number;
}

/** Deterministic per-vertex brightness jitter so flat regolith reads as a surface; decorative only. */
const jitter = (i: number) => { const s = Math.sin(i * 12.9898) * 43758.5453; return s - Math.floor(s); };

const light = new Color(PALETTE.regolith), dark = new Color(PALETTE.regolithDark), space = new Color(PALETTE.space);

/** Decorative regolith shading: brighter on highs, darker on steep ground, fading out at the patch edge. */
function regolithColour(i: number, heightM: number, slope: number, edge: number, out: Color): Color {
  const t = Math.max(0, Math.min(1, 0.55 + heightM / 40));
  out.copy(dark).lerp(light, t);
  if (!Number.isNaN(slope)) out.multiplyScalar(1 - Math.min(0.25, slope / 60));
  out.multiplyScalar(0.92 + 0.14 * jitter(i));
  return out.lerp(space, edge);
}

function slopeColour(slope: number, limit: number, out: Color): Color {
  if (Number.isNaN(slope)) return out.set(PALETTE.unknown).multiplyScalar(0.45);
  if (slope <= limit * 0.5) return out.set(PALETTE.pass);
  if (slope <= limit) return out.set(PALETTE.caution);
  return out.set(PALETTE.fail);
}

/** DEM patch around the lander. Lit by the scene lights; the lander's shadow on it is decorative, not a terrain shadow model. */
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
    const uv = new Float32Array((mesh.positions.length / 3) * 2);
    for (let i = 0; i < uv.length / 2; i++) { uv[i * 2] = mesh.positions[i * 3] / GRAIN_TILE_M; uv[i * 2 + 1] = mesh.positions[i * 3 + 2] / GRAIN_TILE_M; }
    g.setAttribute('uv', new BufferAttribute(uv, 2));
    g.computeVertexNormals();
    return g;
  }, [mesh]);
  useEffect(() => () => geometry?.dispose(), [geometry]);

  const invalidate = useThree(s => s.invalidate);
  const controls = useThree(s => s.controls) as unknown as CameraControlsImpl | null;
  useLayoutEffect(() => {
    if (!geometry || 'problem' in mesh) return;
    const colours = new Float32Array(mesh.slopeDeg.length * 3);
    const c = new Color();
    let half = 0;
    for (let i = 0; i < mesh.slopeDeg.length; i++) half = Math.max(half, Math.abs(mesh.positions[i * 3]), Math.abs(mesh.positions[i * 3 + 2]));
    mesh.slopeDeg.forEach((s, i) => {
      const x = mesh.positions[i * 3], y = mesh.positions[i * 3 + 1], z = mesh.positions[i * 3 + 2];
      const edge = half > 0 ? Math.max(0, Math.min(1, (Math.max(Math.abs(x), Math.abs(z)) / half - 0.7) / 0.3)) ** 1.5 : 0;
      (slopeColours ? slopeColour(s, slopeLimitDeg, c) : regolithColour(i, y, s, edge, c)).toArray(colours, i * 3);
    });
    geometry.setAttribute('color', new BufferAttribute(colours, 3));
    invalidate();
  }, [geometry, mesh, slopeColours, slopeLimitDeg, invalidate]);

  const grain = regolithTexture();
  const material = useMemo(() => {
    const m = new MeshStandardMaterial({ vertexColors: true, roughness: 0.97, metalness: 0, envMapIntensity: 0.25 });
    if (grain && !slopeColours) { m.map = grain; m.bumpMap = grain; m.bumpScale = 0.06; }
    m.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <lights_physical_pars_fragment>',
        ShaderChunk.lights_physical_pars_fragment,
      ).replace(
        'float dotNL = saturate( dot( geometryNormal, directLight.direction ) );',
        `vec3 lpUp = normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz );
        float lpSinEl = max( dot( directLight.direction, lpUp ), 0.0 );
        float lpBlend = smoothstep( 0.15, 0.35, lpSinEl );
        float lpGain = mix( max( 1.0, ${GRAZING_FLAT_LIGHT.toFixed(3)} / max( lpSinEl, 0.004 ) ), 1.0, lpBlend );
        float dotNL = min( saturate( dot( geometryNormal, directLight.direction ) * lpGain ), mix( 0.55, 1.0, lpBlend ) );`,
      );
    };
    m.customProgramCacheKey = () => 'lp-terrain-grazing';
    return m;
  }, [grain, slopeColours]);
  useEffect(() => () => material.dispose(), [material]);

  if ('problem' in mesh || !geometry) {
    return (
      <group>
        <gridHelper args={[120, 24, PALETTE.unknown, '#2a2f38']} />
        <Label position={[0, 0.5, 8]} tone={PALETTE.unknown}>Terrain unknown: {'problem' in mesh ? mesh.problem : 'no mesh'}</Label>
      </group>
    );
  }
  const focus = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    controls?.setTarget(e.point.x, e.point.y + 0.5, e.point.z, true);
  };
  return (
    <mesh geometry={geometry} material={material} receiveShadow name="terrain" onDoubleClick={focus} />
  );
}
