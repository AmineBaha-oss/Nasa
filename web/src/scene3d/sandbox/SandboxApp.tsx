import { lazy, Suspense, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { createEvaluator } from '../../integration/evaluate';
import { HARDWARE_PRESETS } from '../../integration/hardware';
import { loadMissionData, type MissionData } from '../../integration/loader';
import { DEFAULT_LAYERS, type CameraMode, type SceneLayers } from '../types';

/**
 * DEV HARNESS ONLY (served at /scene3d-sandbox.html by `npm run dev`; not part of the production build).
 * Bare controls to exercise LanderScene with real processed data. Person B builds the real HUD.
 */
const LanderScene = lazy(() => import('../LanderScene'));
const CAMERAS: CameraMode[] = ['orbit', 'lander', 'top', 'hardware'];
const panel: CSSProperties = {
  position: 'absolute', top: 8, right: 8, zIndex: 30, width: 280, maxHeight: 'calc(100vh - 16px)', overflow: 'auto',
  background: 'rgba(10,15,23,.9)', color: '#eceae4', font: '12px system-ui, sans-serif', padding: 10, borderRadius: 6,
  border: '1px solid rgba(160,175,195,.25)', display: 'grid', gap: 6,
};

export function SandboxApp() {
  const [mission, setMission] = useState<MissionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dataset, setDataset] = useState(0);
  const [sample, setSample] = useState(0);
  const [preset, setPreset] = useState(0);
  const [yaw, setYaw] = useState(0);
  const [camera, setCamera] = useState<CameraMode>('orbit');
  const [layers, setLayers] = useState<SceneLayers>(DEFAULT_LAYERS);
  const [exaggeration, setExaggeration] = useState(1);
  useEffect(() => {
    loadMissionData(`${import.meta.env.BASE_URL}data/`).then(setMission, e => setError(String(e)));
  }, []);
  const evaluate = useMemo(() => (mission ? createEvaluator(mission.terrainBySite) : null), [mission]);
  if (error) return <p style={{ color: '#ff5d55' }}>{error}</p>;
  if (!mission || !evaluate) return <p style={{ color: '#eceae4' }}>Loading processed data…</p>;
  const data = mission.datasets[dataset];
  const hardware = HARDWARE_PRESETS[preset];
  const evaluation = evaluate(data, hardware, yaw);
  const s = data.samples[Math.min(sample, data.samples.length - 1)];
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Suspense fallback={<p style={{ color: '#eceae4' }}>Loading 3D…</p>}>
        <LanderScene data={data} terrain={mission.terrainBySite.get(data.site.id) ?? null} sampleIndex={Math.min(sample, data.samples.length - 1)}
          hardware={hardware} yawDeg={yaw} evaluation={evaluation} layers={layers} cameraMode={camera}
          verticalExaggeration={exaggeration} reducedMotion={false} onYawChange={setYaw} onCameraModeChange={setCamera} />
      </Suspense>
      <div style={panel}>
        <strong>3D sandbox (dev only)</strong>
        <select aria-label="Site and window" value={dataset} onChange={e => { setDataset(+e.target.value); setSample(0); }}>
          {mission.datasets.map((d, i) => <option key={i} value={i}>{d.site.name} · {d.samples[0]?.utc.slice(0, 10)}</option>)}
        </select>
        <label>Hour {sample}: {s?.utc}<input type="range" min={0} max={data.samples.length - 1} value={sample} onChange={e => setSample(+e.target.value)} style={{ width: '100%' }} /></label>
        <select aria-label="Hardware preset" value={preset} onChange={e => setPreset(+e.target.value)}>
          {HARDWARE_PRESETS.map((h, i) => <option key={i} value={i}>{h.name}</option>)}
        </select>
        <label>Heading {yaw}°<input type="range" min={0} max={359} value={yaw} onChange={e => setYaw(+e.target.value)} style={{ width: '100%' }} /></label>
        <label>Heights ×{exaggeration}<input type="range" min={1} max={5} step={0.5} value={exaggeration} onChange={e => setExaggeration(+e.target.value)} style={{ width: '100%' }} /></label>
        <div>{CAMERAS.map(c => <button key={c} type="button" onClick={() => setCamera(c)} disabled={c === camera}>{c}</button>)}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
          {(Object.keys(layers) as (keyof SceneLayers)[]).map(k => (
            <label key={k}><input type="checkbox" checked={layers[k]} onChange={e => setLayers({ ...layers, [k]: e.target.checked })} /> {k}</label>
          ))}
        </div>
        <div>SOL {evaluation.solar.status} · BAT {evaluation.battery.status} · ANT {evaluation.antenna.status} · DEP {evaluation.deployment.status}</div>
      </div>
    </div>
  );
}
