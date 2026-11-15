import type { HardwareConfig, SiteDateData } from '../../contracts';
import { hasFullCoverageEvidence } from '../../integration/quality';
import type { CameraMode, SceneLayers } from '../../scene3d/types';
import { periodLabel } from '../SelectionPanel';
import type { NavigatorState } from '../../state/navigatorState';

const LAYER_META: { key: keyof SceneLayers; label: string; swatch: string }[] = [
  { key: 'terrain', label: 'Terrain', swatch: '#5a5044' },
  { key: 'slopeColours', label: 'Slope colours', swatch: '#f59e0b' },
  { key: 'skyline', label: 'Skyline', swatch: '#93c5fd' },
  { key: 'sunPath', label: 'Sun path', swatch: '#fb923c' },
  { key: 'earthPath', label: 'Earth path', swatch: '#60a5fa' },
  { key: 'antennaBeam', label: 'Antenna beam', swatch: '#a78bfa' },
  { key: 'panelGlow', label: 'Panel glow', swatch: '#fde68a' },
  { key: 'ramp', label: 'Ramp', swatch: '#86efac' },
  { key: 'footprint', label: 'Footprint', swatch: '#fca5a5' },
  { key: 'labels', label: 'Labels', swatch: '#e5e7eb' },
];

const CAMERAS: { mode: CameraMode; label: string }[] = [
  { mode: 'orbit', label: 'Orbit' },
  { mode: 'lander', label: 'Lander eye' },
  { mode: 'top', label: 'Top' },
  { mode: 'hardware', label: 'Hardware' },
];

interface Props {
  datasets: SiteDateData[];
  hardwarePresets: HardwareConfig[];
  state: NavigatorState;
  data: SiteDateData;
  hardware: HardwareConfig;
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

export function ControlDock(p: Props) {
  const sites = [...new Map(p.datasets.map((d, i) => [d.site.id, { d, i }])).values()];
  const periods = p.datasets
    .map((d, i) => ({ d, i }))
    .filter(x => x.d.site.id === p.data.site.id);

  return (
    <aside className={p.collapsed ? 'lp3-dock is-collapsed' : 'lp3-dock'} aria-label="3D mission controls">
      <div className="lp3-dock-head">
        <p className="lp3-dock-title">Controls</p>
        <button type="button" onClick={p.onToggleCollapsed} aria-expanded={!p.collapsed}>
          {p.collapsed ? 'Open' : 'Hide'}
        </button>
      </div>
      {!p.collapsed && (
        <div className="lp3-dock-body">
          <section>
            <h3>Site</h3>
            <div className="lp3-chips" role="listbox" aria-label="Site">
              {sites.map(({ d, i }) => {
                const full = hasFullCoverageEvidence(d);
                return (
                  <button key={d.site.id} type="button" role="option" aria-selected={p.data.site.id === d.site.id}
                    className={p.data.site.id === d.site.id ? 'is-active' : undefined}
                    onClick={() => p.onDataset(i)}>
                    <span>{d.site.id}</span>
                    <small title={full ? 'Far-field validated research data' : 'Limited evidence'}>{full ? 'OK' : '?'}</small>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <h3>UTC period</h3>
            <div className="lp3-seg" role="group" aria-label="UTC period">
              {periods.map(({ d, i }, k) => (
                <button key={i} type="button" aria-pressed={p.state.datasetIndex === i}
                  className={p.state.datasetIndex === i ? 'is-active' : undefined}
                  onClick={() => p.onDataset(i)}>
                  {k === 0 ? 'Window A' : 'Window B'}
                  <small>{periodLabel(d)}</small>
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3>Hardware preset</h3>
            <p className="lp3-note">Equal-area note: {p.hardware.totalActivePvAreaM2.toFixed(1)} m² each</p>
            <div className="lp3-hw">
              {p.hardwarePresets.map((h, i) => (
                <button key={h.name} type="button" aria-pressed={p.state.hardwareIndex === i}
                  className={p.state.hardwareIndex === i ? 'is-active' : undefined}
                  onClick={() => p.onHardware(i)}>
                  <span className="lp3-hw-ico" aria-hidden="true">{h.panels.length === 4 ? '▣' : h.panels[0]?.mode === 'tracked' ? '◎' : '▭'}</span>
                  <span>{h.name.replace(/^Illustrative /, '')}</span>
                  <small>hypothetical</small>
                </button>
              ))}
            </div>
            <button type="button" className="lp3-linkish" onClick={() => p.onCameraMode('hardware')}>View hardware</button>
          </section>

          <section>
            <h3>Heading</h3>
            <div className="lp3-yaw">
              <input type="number" min={0} max={359} value={p.state.yawDeg} aria-label="Exact heading"
                onChange={e => p.onYaw(Number(e.target.value))} />
              <span>°</span>
              {[-15, -1, 1, 15].map(d => (
                <button key={d} type="button" onClick={() => p.onNudgeYaw(d)}
                  aria-label={`Turn ${Math.abs(d)}° ${d > 0 ? 'clockwise' : 'counter-clockwise'}`}>
                  {d > 0 ? `+${d}` : d}°
                </button>
              ))}
            </div>
            <p className="lp3-hint">Arrow keys ±1°, Shift+arrow ±15°. Dial and 3D heading ring stay in sync.</p>
          </section>

          <section>
            <h3>Layers</h3>
            <ul className="lp3-layers">
              {LAYER_META.map(L => (
                <li key={L.key}>
                  <label>
                    <input type="checkbox" checked={p.state.layers[L.key]}
                      onChange={() => p.onToggleLayer(L.key)} />
                    <span className="lp3-swatch" style={{ background: L.swatch }} aria-hidden="true" />
                    {L.label}
                  </label>
                </li>
              ))}
            </ul>
            <button type="button" className="lp3-linkish" onClick={p.onResetLayers}>Reset layers</button>
          </section>

          <section>
            <h3>Camera</h3>
            <div className="lp3-seg">
              {CAMERAS.map(c => (
                <button key={c.mode} type="button" aria-pressed={p.state.cameraMode === c.mode}
                  className={p.state.cameraMode === c.mode ? 'is-active' : undefined}
                  onClick={() => p.onCameraMode(c.mode)}>{c.label}</button>
              ))}
            </div>
            <label className="lp3-exag">Vertical exaggeration
              <input type="range" min={1} max={5} step={0.5} value={p.state.verticalExaggeration}
                onChange={e => p.onExaggeration(Number(e.target.value))} />
              <span>{p.state.verticalExaggeration === 1 ? '1× true scale' : `${p.state.verticalExaggeration}× (labelled)`}</span>
            </label>
          </section>
        </div>
      )}
    </aside>
  );
}
