import { useCallback, useEffect, useMemo, useState } from 'react';
import type { HardwareConfig, HeadingEvaluation, SiteDateData } from '../contracts';
import { hasFullCoverageEvidence } from '../integration/quality';
import { ApolloEasterEgg } from '../components/ApolloEasterEgg';
import { ComparisonTable } from '../components/ComparisonTable';
import { ConstraintCard } from '../components/ConstraintCard';
import { DataQualityNotice } from '../components/DataQualityNotice';
import { HeroSection } from '../components/HeroSection';
import { HorizonWheel } from '../components/HorizonWheel';
import { IntroSequence, shouldPlayIntro } from '../components/IntroSequence';
import { LanderTopDown } from '../components/LanderTopDown';
import { QualityChips } from '../components/QualityChips';
import { SelectionPanel } from '../components/SelectionPanel';
import { YawControl } from '../components/YawControl';
import '../styles/navigator.css';

export type EvaluateHeading = (data: SiteDateData, hardware: HardwareConfig, yawDeg: number) => HeadingEvaluation | null;

export interface NavigatorPageProps {
  /** Processed science JSON (contract v1.0). Integration supplies it; the page never fetches rasters. */
  datasets: SiteDateData[];
  hardwarePresets: HardwareConfig[];
  /** Engine adapter wired by integration. Absent → every check shows Unknown. */
  evaluate?: EvaluateHeading;
  initialYawDeg?: number;
}

type IntroPhase = 'off' | 'count' | 'draw';

export function NavigatorPage({ datasets, hardwarePresets, evaluate, initialYawDeg = 0 }: NavigatorPageProps) {
  const [datasetIndex, setDatasetIndex] = useState(0);
  const [sampleIndex, setSampleIndex] = useState(0);
  const [hardwareIndex, setHardwareIndex] = useState(0);
  const [yawDeg, setYawDeg] = useState(initialYawDeg);
  // Only discrete step buttons animate the turn; drag, knob, slider and keyboard input apply instantly.
  const [animateTurn, setAnimateTurn] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [intro, setIntro] = useState<IntroPhase>('off');
  const turn = useCallback((deg: number, animate: boolean) => { setAnimateTurn(animate); setYawDeg(deg); }, []);
  const turnInstantly = useCallback((deg: number) => turn(deg, false), [turn]);
  const changeDataset = useCallback((i: number) => { if (i >= 0) { setDatasetIndex(i); setSampleIndex(0); } }, []);
  const introCounted = useCallback(() => setIntro('draw'), []);
  useEffect(() => { if (shouldPlayIntro()) setIntro('count'); }, []);
  useEffect(() => {
    if (intro !== 'draw') return;
    const t = window.setTimeout(() => setIntro('off'), 900);
    return () => window.clearTimeout(t);
  }, [intro]);

  const hardware = hardwarePresets[hardwareIndex] ?? null;
  const alternatives = useMemo(() => datasets.map(data => ({
    data,
    evaluation: evaluate && hardware ? evaluate(data, hardware, yawDeg) : null,
    evidenceComplete: hasFullCoverageEvidence(data),
  })), [datasets, evaluate, hardware, yawDeg]);

  if (datasets.length === 0) {
    return <main className="lp-page lp-page-empty"><header className="lp-empty-head"><p className="lp-wordmark">Landerprint</p>
      <h1>Which way should the lander face?</h1>
      <p className="lp-lede" role="status">No processed science data loaded. Results stay unknown until the science module delivers versioned JSON.</p></header></main>;
  }
  const current = alternatives[datasetIndex];
  const data = current.data;
  const sample = data.samples[Math.min(sampleIndex, data.samples.length - 1)] ?? null;
  const ev = current.evaluation;
  const windowHours = ev ? (Date.parse(ev.endUtc) - Date.parse(ev.startUtc)) / 3.6e6 : null;
  const batteryGauge = ev?.minimumBatteryWh != null && hardware ? ev.minimumBatteryWh / hardware.batteryCapacityWh : null;
  const contactGauge = ev?.contactHours != null && windowHours ? ev.contactHours / windowHours : null;

  return (
    <main className="lp-page">
      <DataQualityNotice data={data} hardware={hardware} />
      <HeroSection data={data} sample={sample} yawDeg={yawDeg} hardware={hardware} />

      <section id="lp-cockpit" className="lp-cockpit" aria-label="Instrument">
        <div className={drawerOpen ? 'lp-rail is-open' : 'lp-rail'} id="lp-rail">
          <div className="lp-rail-head">
            <p className="lp-rail-title">Mission setup</p>
            <button type="button" className="lp-drawer-close" onClick={() => setDrawerOpen(false)}>Done</button>
          </div>
          <SelectionPanel datasets={datasets} datasetIndex={datasetIndex} onDataset={changeDataset}
            sampleIndex={sampleIndex} onSample={setSampleIndex}
            hardwarePresets={hardwarePresets} hardwareIndex={hardwareIndex} onHardware={setHardwareIndex} />
        </div>
        {drawerOpen && <button type="button" className="lp-scrim" aria-label="Close mission setup" onClick={() => setDrawerOpen(false)} />}

        <div className="lp-center" key={`${data.site.id}-${datasetIndex}`}>
          <div className="lp-center-head">
            <p className="lp-panel-tag" aria-hidden="true"><span>HZN-01</span><span>REV A</span><span>{data.site.latitudeDeg.toFixed(3)} / {data.site.longitudeEastDeg.toFixed(3)}E</span></p>
            <QualityChips data={data} hardware={hardware} />
          </div>
          <HorizonWheel sunHorizon={data.sunHorizon} earthHorizon={data.earthHorizon} sample={sample} yawDeg={yawDeg} hardware={hardware}
            onYawChange={turnInstantly} animateTurn={animateTurn} intro={intro === 'draw'} />
          <div className="lp-helm">
            <button type="button" className="lp-drawer-open" aria-controls="lp-rail" aria-expanded={drawerOpen} onClick={() => setDrawerOpen(true)}>Setup</button>
            <YawControl valueDeg={yawDeg} onChange={turn} animate={animateTurn} />
          </div>
        </div>

        <aside className="lp-starboard" aria-label="Lander">
          <p className="lp-panel-tag" aria-hidden="true"><span>VIEW-02</span><span>TOP-DOWN</span></p>
          <LanderTopDown hardware={hardware} yawDeg={yawDeg} animateTurn={animateTurn} sunAzDeg={sample?.sun?.azDeg ?? null} />
        </aside>
      </section>

      <section className="lp-checks" aria-labelledby="lp-checks-h">
        <div className="lp-section-head"><h2 id="lp-checks-h">Modeled checks at {yawDeg}°</h2><QualityChips data={data} hardware={hardware} /></div>
        <div className="lp-cards">
          <ConstraintCard code="CHK-SOL" title="Solar power" result={ev?.solar ?? null} evidenceComplete={current.evidenceComplete} />
          <ConstraintCard code="CHK-BAT" title="Battery" result={ev?.battery ?? null} evidenceComplete={current.evidenceComplete}
            gauge={batteryGauge} gaugeLabel={batteryGauge === null ? undefined : `${Math.round(batteryGauge * 100)}%`} />
          <ConstraintCard code="CHK-ANT" title="Earth antenna" result={ev?.antenna ?? null} evidenceComplete={current.evidenceComplete}
            gauge={contactGauge} gaugeLabel={contactGauge === null ? undefined : `${Math.round(contactGauge * 100)}%`} />
          <ConstraintCard code="CHK-DEP" title="Deployment (preliminary)" result={ev?.deployment ?? null} evidenceComplete={current.evidenceComplete} />
        </div>
        {ev && ev.unresolved.length > 0 && <div className="lp-unresolved"><h3>Unresolved inputs</h3><ul>{ev.unresolved.map(u => <li key={u}>{u}</li>)}</ul></div>}
        {!evaluate && <p className="lp-hint" role="status">Engine adapter not connected yet: all checks are Unknown.</p>}
        <p className="lp-hint">Battery gauge: engine minimum battery ÷ preset capacity. Antenna gauge: engine contact hours ÷ evaluated window. No gauge value is shown without an engine result.</p>
      </section>

      <ComparisonTable alternatives={alternatives} yawDeg={yawDeg} />
      {intro === 'count' && <IntroSequence onDone={introCounted} />}
      <ApolloEasterEgg />
    </main>
  );
}
