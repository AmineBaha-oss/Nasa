import type { ReactNode } from 'react';
import type { HardwareConfig, SiteDateData } from '../../contracts';
import { hasFullCoverageEvidence } from '../../integration/quality';
import type { CameraMode, SceneLayers } from '../../scene3d/types';
import { periodLabel } from '../SelectionPanel';
import type { NavigatorState } from '../../state/navigatorState';
import { HeadingDial } from './HeadingDial';

const LAYER_META: { key: keyof SceneLayers; label: string; swatch: string }[] = [
  { key: 'terrain', label: 'Terrain', swatch: '#8c8577' },
  { key: 'slopeColours', label: 'Slope colours', swatch: '#f59e0b' },
  { key: 'skyline', label: 'Skyline', swatch: '#ffb547' },
  { key: 'sunPath', label: 'Sun path', swatch: '#ffb547' },
  { key: 'earthPath', label: 'Earth path', swatch: '#5cc8ff' },
  { key: 'antennaBeam', label: 'Antenna beam', swatch: '#5cc8ff' },
  { key: 'panelGlow', label: 'Sunlight on panels', swatch: '#ffe2b8' },
  { key: 'ramp', label: 'Ramp', swatch: '#cfd4db' },
  { key: 'footprint', label: 'Footprint', swatch: '#9aa5b5' },
  { key: 'labels', label: 'Labels', swatch: '#e9ecf1' },
];

interface Props {
  datasets: SiteDateData[];
  hardwarePresets: HardwareConfig[];
  state: NavigatorState;
  data: SiteDateData;
  hardware: HardwareConfig;
  sunAzDeg: number | null;
  earthAzDeg: number | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onDataset: (i: number) => void;
  onHardware: (i: number) => void;
  onYaw: (deg: number) => void;
  onNudgeYaw: (delta: number) => void;
  onToggleLayer: (key: keyof SceneLayers) => void;
  onResetLayers: () => void;
  onCameraMode: (mode: CameraMode) => void;
  onExaggeration: (v: number) => void;
}

function Section({ title, summary, open = true, children }: { title: string; summary?: ReactNode; open?: boolean; children: ReactNode }) {
  return (
    <details className="lp3-section" open={open}>
      <summary><span className="lp3-section-title">{title}</span>{summary !== undefined && <span className="lp3-section-sum">{summary}</span>}</summary>
      <div className="lp3-section-body">{children}</div>
    </details>
  );
}

function hardwareIcon(h: HardwareConfig): ReactNode {
  if (h.panels.length >= 4) return <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="5" y="5" width="10" height="10" rx="1" /><path d="M10 1v3M10 16v3M1 10h3M16 10h3" /></svg>;
  if (h.panels[0]?.mode === 'tracked') return <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="3" /><path d="M10 2v3M10 15v3M2 10h3M15 10h3M4.3 4.3l2.1 2.1M13.6 13.6l2.1 2.1M4.3 15.7l2.1-2.1M13.6 6.4l2.1-2.1" /></svg>;
  return <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="4" y="3" width="12" height="14" rx="1" /><path d="M4 8h12M4 12h12M10 3v14" /></svg>;
}

export function ControlDock(p: Props) {
  const sites = [...new Map(p.datasets.map((d, i) => [d.site.id, { d, i }])).values()];
  const periods = p.datasets.map((d, i) => ({ d, i })).filter(x => x.d.site.id === p.data.site.id);
  const periodIndex = periods.findIndex(x => x.i === p.state.datasetIndex);
  const layersOn = LAYER_META.filter(L => p.state.layers[L.key]).length;

  if (p.collapsed) {
    return (
      <button type="button" className="lp3-dock-open" onClick={p.onToggleCollapsed} aria-expanded={false}>
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        Mission
      </button>
    );
  }

  return (
    <aside className="lp3-dock" aria-label="3D mission controls">
      <div className="lp3-dock-head">
        <div>
          <p className="lp3-dock-kicker">Site {p.data.site.id}</p>
          <p className="lp3-dock-title">{p.data.site.name}</p>
        </div>
        <button type="button" className="lp3-icon-btn" onClick={p.onToggleCollapsed} aria-expanded={true} aria-label="Hide mission panel" title="Hide mission panel">
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
      <div className="lp3-dock-body">
        <Section title="Site" summary={p.data.site.id}>
          <div className="lp3-chips" role="listbox" aria-label="Site">
            {sites.map(({ d, i }) => {
              const full = hasFullCoverageEvidence(d);
              const active = p.data.site.id === d.site.id;
              return (
                <button key={d.site.id} type="button" role="option" aria-selected={active} className={active ? 'is-active' : undefined}
                  title={`${d.site.name}: ${full ? 'far-field validated research data' : 'limited evidence'}`} onClick={() => p.onDataset(i)}>
                  <span>{d.site.id.replace(/^site-/, '')}</span>
                  <small className={full ? 'is-ok' : 'is-limited'}>{full ? 'OK' : '?'}</small>
                </button>
              );
            })}
          </div>
        </Section>

        <Section title="UTC period" summary={periodIndex >= 0 ? `Window ${periodIndex === 0 ? 'A' : 'B'}` : undefined}>
          <div className="lp3-seg lp3-seg-stack" role="group" aria-label="UTC period">
            {periods.map(({ d, i }, k) => (
              <button key={i} type="button" aria-pressed={p.state.datasetIndex === i} className={p.state.datasetIndex === i ? 'is-active' : undefined}
                onClick={() => p.onDataset(i)}>
                Window {k === 0 ? 'A' : 'B'}
                <small>{periodLabel(d)}</small>
              </button>
            ))}
          </div>
        </Section>

        <Section title="Hardware" summary="hypothetical">
          <p className="lp3-note">Every preset has the same {p.hardware.totalActivePvAreaM2.toFixed(1)} m² of active cells.</p>
          <div className="lp3-hw">
            {p.hardwarePresets.map((h, i) => (
              <button key={h.name} type="button" aria-pressed={p.state.hardwareIndex === i} className={p.state.hardwareIndex === i ? 'is-active' : undefined}
                onClick={() => p.onHardware(i)}>
                <span className="lp3-hw-ico">{hardwareIcon(h)}</span>
                <span>{h.name.replace(/^Illustrative /, '')}</span>
                <small>hypothetical</small>
              </button>
            ))}
          </div>
          <button type="button" className="lp3-linkish" onClick={() => p.onCameraMode('hardware')}>Inspect hardware close up</button>
        </Section>

        <Section title="Heading" summary={`${p.state.yawDeg}°`}>
          <div className="lp3-heading">
            <HeadingDial yawDeg={p.state.yawDeg} sunAzDeg={p.sunAzDeg} earthAzDeg={p.earthAzDeg} onYaw={p.onYaw} onNudge={p.onNudgeYaw} />
            <div className="lp3-heading-side">
              <label className="lp3-yaw-input">
                <input type="number" min={0} max={359} value={p.state.yawDeg} aria-label="Exact heading"
                  onChange={e => p.onYaw(Number(e.target.value))} />
                <span>°</span>
              </label>
              <div className="lp3-yaw">
                {[-15, -1, 1, 15].map(d => (
                  <button key={d} type="button" onClick={() => p.onNudgeYaw(d)}
                    aria-label={`Turn ${Math.abs(d)}° ${d > 0 ? 'clockwise' : 'counter-clockwise'}`}>
                    {d > 0 ? `+${d}` : `−${-d}`}
                  </button>
                ))}
              </div>
              <ul className="lp3-legend">
                <li><span className="lp3-dot is-sun" aria-hidden="true" />Sun now</li>
                <li><span className="lp3-dot is-earth" aria-hidden="true" />Earth now</li>
              </ul>
            </div>
          </div>
          <p className="lp3-hint">Drag the dial or the orange ring in the scene. Arrow keys ±1°, Shift ±15°.</p>
        </Section>

        <Section title="Layers" summary={`${layersOn} of ${LAYER_META.length} on`} open={false}>
          <div className="lp3-layers" role="group" aria-label="Scene layers">
            {LAYER_META.map(L => (
              <label key={L.key} className={p.state.layers[L.key] ? 'is-on' : undefined}>
                <input type="checkbox" checked={p.state.layers[L.key]} onChange={() => p.onToggleLayer(L.key)} />
                <span className="lp3-swatch" style={{ background: L.swatch }} aria-hidden="true" />
                {L.label}
              </label>
            ))}
          </div>
          <button type="button" className="lp3-linkish" onClick={p.onResetLayers}>Reset layers</button>
          <label className="lp3-exag">
            <span>Vertical exaggeration <strong>{p.state.verticalExaggeration === 1 ? '1× true scale' : `${p.state.verticalExaggeration}× (labelled)`}</strong></span>
            <input type="range" min={1} max={5} step={0.5} value={p.state.verticalExaggeration}
              onChange={e => p.onExaggeration(Number(e.target.value))} />
          </label>
        </Section>
      </div>
    </aside>
  );
}
