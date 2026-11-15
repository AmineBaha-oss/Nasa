import { useCallback, useEffect, useMemo, useReducer, useState, useDeferredValue } from 'react';
import type { HardwareConfig, HeadingEvaluation, SiteDateData, SiteTerrain } from '../contracts';
import { hasFullCoverageEvidence } from '../integration/quality';
import { ApolloEasterEgg } from '../components/ApolloEasterEgg';
import { ComparisonTable } from '../components/ComparisonTable';
import { LiveChecks } from '../components/LiveChecks';
import { HeroSection } from '../components/HeroSection';
import { HorizonWheel } from '../components/HorizonWheel';
import { IntroSequence, shouldPlayIntro } from '../components/IntroSequence';
import { LanderTopDown } from '../components/LanderTopDown';
import { QualityChips } from '../components/QualityChips';
import { SelectionPanel } from '../components/SelectionPanel';
import { SiteFooter } from '../components/SiteFooter';
import { YawControl } from '../components/YawControl';
import { Scene3DShell } from '../components/hud/Scene3DShell';
import { DEFAULT_LAYERS } from '../scene3d/types';
import { createInitialState, navigatorReducer } from '../state/navigatorState';
import { parseHash, prefersReducedMotion, resolveDatasetIndex, serializeHash } from '../state/urlHash';
import '../styles/navigator.css';
import '../styles/scene3d.css';

export type EvaluateHeading = (data: SiteDateData, hardware: HardwareConfig, yawDeg: number) => HeadingEvaluation | null;

export interface NavigatorPageProps {
  datasets: SiteDateData[];
  hardwarePresets: HardwareConfig[];
  evaluate?: EvaluateHeading;
  initialYawDeg?: number;
  /** Per-site DEM/slope patches for the deployment screen and 3D terrain. */
  terrainBySite?: ReadonlyMap<string, SiteTerrain>;
}

type IntroPhase = 'off' | 'count' | 'draw';

export function NavigatorPage({ datasets, hardwarePresets, evaluate, initialYawDeg = 0, terrainBySite }: NavigatorPageProps) {
  const [state, dispatch] = useReducer(
    navigatorReducer,
    undefined,
    () => {
      const parsed = typeof window !== 'undefined' ? parseHash(window.location.hash) : {};
      const datasetIndex = resolveDatasetIndex(datasets, parsed, 0);
      return createInitialState({
        datasetIndex,
        sampleIndex: parsed.sampleIndex ?? 0,
        hardwareIndex: parsed.hardwareIndex ?? 0,
        yawDeg: parsed.yawDeg ?? initialYawDeg,
        view: parsed.view ?? '2d',
      });
    },
  );
  const [animateTurn, setAnimateTurn] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [intro, setIntro] = useState<IntroPhase>('off');
  const [focus, setFocus] = useState<'solar' | 'battery' | 'antenna' | 'deployment' | null>(null);

  const deferredYaw = useDeferredValue(state.yawDeg);
  const data = datasets[Math.min(state.datasetIndex, Math.max(0, datasets.length - 1))] ?? null;
  const hardware = hardwarePresets[Math.min(state.hardwareIndex, Math.max(0, hardwarePresets.length - 1))] ?? null;
  const sampleCount = data?.samples.length ?? 0;

  useEffect(() => {
    if (!data) return;
    dispatch({
      type: 'hydrate',
      partial: { sampleIndex: state.sampleIndex, layers: state.layers, cameraMode: state.cameraMode },
      sampleCount: data.samples.length,
      datasetCount: datasets.length,
      hardwareCount: hardwarePresets.length,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-clamp when dataset identity changes
  }, [data?.site.id, data?.samples[0]?.utc, datasets.length, hardwarePresets.length]);

  useEffect(() => {
    if (!data || typeof window === 'undefined') return;
    const next = `#${serializeHash(state, data)}`;
    if (window.location.hash !== next) window.history.replaceState(null, '', next);
  }, [state, data]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onHash = () => {
      const parsed = parseHash(window.location.hash);
      const datasetIndex = resolveDatasetIndex(datasets, parsed, state.datasetIndex);
      const nextData = datasets[datasetIndex];
      dispatch({
        type: 'hydrate',
        partial: {
          datasetIndex,
          sampleIndex: parsed.sampleIndex ?? state.sampleIndex,
          hardwareIndex: parsed.hardwareIndex ?? state.hardwareIndex,
          yawDeg: parsed.yawDeg ?? state.yawDeg,
          view: parsed.view ?? state.view,
          cameraMode: parsed.cameraMode,
          layers: parsed.layers ? { ...DEFAULT_LAYERS, ...parsed.layers } : undefined,
        },
        sampleCount: nextData?.samples.length ?? 0,
        datasetCount: datasets.length,
        hardwareCount: hardwarePresets.length,
      });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- listen once; read latest via closures on each event
  }, [datasets, hardwarePresets]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'v' || e.key === 'V') { e.preventDefault(); dispatch({ type: 'toggleView' }); return; }
      if (state.view !== '3d') return;
      const step = e.shiftKey ? 15 : 1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); dispatch({ type: 'nudgeYaw', delta: step }); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); dispatch({ type: 'nudgeYaw', delta: -step }); }
      if (e.key === ',' || e.key === '.') {
        e.preventDefault();
        dispatch({ type: 'setSample', index: state.sampleIndex + (e.key === '.' ? 1 : -1), sampleCount });
      }
      if (e.key === ' ' && tag !== 'BUTTON' && tag !== 'SUMMARY' && !prefersReducedMotion()) {
        e.preventDefault();
        dispatch({ type: 'setPlaying', playing: !state.playing });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.view, state.sampleIndex, state.playing, sampleCount]);

  const turn = useCallback((deg: number, animate: boolean) => {
    setAnimateTurn(animate);
    dispatch({ type: 'setYaw', deg });
  }, []);
  const turnInstantly = useCallback((deg: number) => turn(deg, false), [turn]);
  const changeDataset = useCallback((i: number) => {
    const next = datasets[i];
    dispatch({ type: 'setDataset', index: i, sampleCount: next?.samples.length ?? 0 });
  }, [datasets]);
  const introCounted = useCallback(() => setIntro('draw'), []);
  useEffect(() => { if (shouldPlayIntro()) setIntro('count'); }, []);
  useEffect(() => {
    if (intro !== 'draw') return;
    const t = window.setTimeout(() => setIntro('off'), 900);
    return () => window.clearTimeout(t);
  }, [intro]);

  const alternatives = useMemo(() => datasets.map(d => ({
    data: d,
    evaluation: evaluate && hardware ? evaluate(d, hardware, deferredYaw) : null,
    evidenceComplete: hasFullCoverageEvidence(d),
  })), [datasets, evaluate, hardware, deferredYaw]);

  const viewToggle = (
    <div className="lp3-viewbar">
      <div className="lp3-viewtoggle" role="group" aria-label="View mode">
        <button type="button" aria-pressed={state.view === '2d'} onClick={() => dispatch({ type: 'setView', view: '2d' })}>2D</button>
        <button type="button" aria-pressed={state.view === '3d'} onClick={() => dispatch({ type: 'setView', view: '3d' })}>3D</button>
      </div>
    </div>
  );

  if (datasets.length === 0 || !data) {
    return <main className="lp-page lp-page-empty"><header className="lp-empty-head"><p className="lp-wordmark">Landerprint</p>
      <h1>Which way should the lander face?</h1>
      <p className="lp-lede" role="status">No processed science data loaded. Results stay unknown.</p></header></main>;
  }

  const current = alternatives[state.datasetIndex] ?? alternatives[0];
  const sample = data.samples[Math.min(state.sampleIndex, data.samples.length - 1)] ?? null;
  const ev = current.evaluation;
  const terrain = terrainBySite?.get(data.site.id) ?? null;

  if (state.view === '3d' && hardware) {
    return (
      <main className="lp-page lp-page-3d">
        <Scene3DShell
          topLeft={(
            <div className="lp3-brandbar">
              <span className="lp3-brand">Landerprint</span>
              <div className="lp3-viewtoggle" role="group" aria-label="View mode">
                <button type="button" aria-pressed={false} onClick={() => dispatch({ type: 'setView', view: '2d' })} title="Switch to 2D (V)">2D</button>
                <button type="button" aria-pressed={true} title="3D view (V)">3D</button>
              </div>
            </div>
          )}
          datasets={datasets} hardwarePresets={hardwarePresets} state={state}
          data={data} hardware={hardware} terrain={terrain} evaluation={ev}
          alternatives={alternatives} deferredYaw={deferredYaw} focus={focus}
          onFallback2d={() => dispatch({ type: 'setView', view: '2d' })}
          onDataset={changeDataset}
          onHardware={i => dispatch({ type: 'setHardware', index: i })}
          onSample={i => dispatch({ type: 'setSample', index: i, sampleCount })}
          onYaw={deg => dispatch({ type: 'setYaw', deg })}
          onNudgeYaw={delta => dispatch({ type: 'nudgeYaw', delta })}
          onToggleLayer={key => dispatch({ type: 'toggleLayer', key })}
          onResetLayers={() => dispatch({ type: 'setLayers', layers: { ...DEFAULT_LAYERS } })}
          onCameraMode={mode => dispatch({ type: 'setCameraMode', mode })}
          onExaggeration={value => dispatch({ type: 'setVerticalExaggeration', value })}
          onPlaying={playing => dispatch({ type: 'setPlaying', playing })}
          onSpeed={speed => dispatch({ type: 'setSpeed', speed })}
          onDetails={(open, f) => { setFocus(f ?? null); dispatch({ type: 'setDetailsOpen', open }); }}
          onDockCollapsed={collapsed => dispatch({ type: 'setDockCollapsed', collapsed })}
        />
        <ApolloEasterEgg />
      </main>
    );
  }

  return (
    <main className="lp-page">
      {viewToggle}
      <HeroSection data={data} sample={sample} yawDeg={state.yawDeg} hardware={hardware} />

      <section id="lp-cockpit" className="lp-cockpit" aria-label="Instrument">
        <LiveChecks evaluation={ev} evidenceComplete={current.evidenceComplete} yawDeg={state.yawDeg} batteryCapacityWh={hardware?.batteryCapacityWh} />
        <div className={drawerOpen ? 'lp-rail is-open' : 'lp-rail'} id="lp-rail">
          <div className="lp-rail-head">
            <p className="lp-rail-title">Mission setup</p>
            <button type="button" className="lp-drawer-close" onClick={() => setDrawerOpen(false)}>Done</button>
          </div>
          <SelectionPanel datasets={datasets} datasetIndex={state.datasetIndex} onDataset={changeDataset}
            sampleIndex={state.sampleIndex} onSample={i => dispatch({ type: 'setSample', index: i, sampleCount })}
            hardwarePresets={hardwarePresets} hardwareIndex={state.hardwareIndex}
            onHardware={i => dispatch({ type: 'setHardware', index: i })} />
        </div>
        {drawerOpen && <button type="button" className="lp-scrim" aria-label="Close mission setup" onClick={() => setDrawerOpen(false)} />}

        <div className="lp-center" key={`${data.site.id}-${state.datasetIndex}`}>
          <div className="lp-center-head">
            <QualityChips data={data} hardware={hardware} />
          </div>
          <HorizonWheel sunHorizon={data.sunHorizon} earthHorizon={data.earthHorizon} sample={sample} yawDeg={state.yawDeg} hardware={hardware}
            onYawChange={turnInstantly} animateTurn={animateTurn} intro={intro === 'draw'} />
          <div className="lp-helm">
            <button type="button" className="lp-drawer-open" aria-controls="lp-rail" aria-expanded={drawerOpen} onClick={() => setDrawerOpen(true)}>Setup</button>
            <YawControl valueDeg={state.yawDeg} onChange={turn} animate={animateTurn} />
          </div>
        </div>

        <aside className="lp-starboard" aria-label="Lander">
          <LanderTopDown hardware={hardware} yawDeg={state.yawDeg} animateTurn={animateTurn} sunAzDeg={sample?.sun?.azDeg ?? null} />
        </aside>
      </section>

      <div className="lp-model-notes">
          {ev && ev.unresolved.length > 0 && (
            <details className="lp-unresolved">
              <summary>Unresolved inputs ({ev.unresolved.length})</summary>
              <ul>{ev.unresolved.map(u => <li key={u}>{u}</li>)}</ul>
            </details>
          )}
          {!evaluate && <p className="lp-hint" role="status">Engine adapter not connected: all checks Unknown.</p>}
      </div>

      <ComparisonTable alternatives={alternatives} yawDeg={deferredYaw} currentIndex={state.datasetIndex} onSelect={changeDataset} />
      <SiteFooter />
      {intro === 'count' && <IntroSequence onDone={introCounted} />}
      <ApolloEasterEgg />
    </main>
  );
}
