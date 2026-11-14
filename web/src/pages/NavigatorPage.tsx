import { useCallback, useMemo, useState } from 'react';
import type { HardwareConfig, HeadingEvaluation, SiteDateData } from '../contracts';
import { hasFullCoverageEvidence } from '../integration/quality';
import { ComparisonTable } from '../components/ComparisonTable';
import { ConstraintCard } from '../components/ConstraintCard';
import { DataQualityNotice } from '../components/DataQualityNotice';
import { HorizonWheel } from '../components/HorizonWheel';
import { LanderTopDown } from '../components/LanderTopDown';
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

export function NavigatorPage({ datasets, hardwarePresets, evaluate, initialYawDeg = 0 }: NavigatorPageProps) {
  const [datasetIndex, setDatasetIndex] = useState(0);
  const [sampleIndex, setSampleIndex] = useState(0);
  const [hardwareIndex, setHardwareIndex] = useState(0);
  const [yawDeg, setYawDeg] = useState(initialYawDeg);
  // Only discrete step buttons animate the turn; drag, slider and keyboard input apply instantly.
  const [animateTurn, setAnimateTurn] = useState(false);
  const turn = useCallback((deg: number, animate: boolean) => { setAnimateTurn(animate); setYawDeg(deg); }, []);
  const turnInstantly = useCallback((deg: number) => turn(deg, false), [turn]);
  const changeDataset = useCallback((i: number) => { if (i >= 0) { setDatasetIndex(i); setSampleIndex(0); } }, []);

  const hardware = hardwarePresets[hardwareIndex] ?? null;
  const alternatives = useMemo(() => datasets.map(data => ({
    data,
    evaluation: evaluate && hardware ? evaluate(data, hardware, yawDeg) : null,
    evidenceComplete: hasFullCoverageEvidence(data),
  })), [datasets, evaluate, hardware, yawDeg]);

  if (datasets.length === 0) {
    return <main className="lp-page"><header className="lp-top"><p className="lp-wordmark">Landerprint</p>
      <h1>Which way should the lander face?</h1>
      <p className="lp-lede" role="status">No processed science data loaded. Results stay unknown until the science module delivers versioned JSON.</p></header></main>;
  }
  const current = alternatives[datasetIndex];
  const data = current.data;
  const sample = data.samples[Math.min(sampleIndex, data.samples.length - 1)] ?? null;
  const ev = current.evaluation;

  return (
    <main className="lp-page">
      <header className="lp-top">
        <p className="lp-wordmark">Landerprint</p>
        <h1>Which way should the lander face?</h1>
        <p className="lp-lede">Pick a site, a UTC period and a heading. The dial shows where the Sun and Earth sit above the local terrain; the checks below report what the engines found.</p>
        <p className="lp-site">
          <strong>{data.site.name}</strong>
          <span>{data.site.latitudeDeg.toFixed(6)}° lat, {data.site.longitudeEastDeg.toFixed(6)}° lon east</span>
          <span>{data.site.label}</span>
        </p>
      </header>
      <DataQualityNotice data={data} hardware={hardware} />
      <div className="lp-grid">
        <HorizonWheel sunHorizon={data.sunHorizon} earthHorizon={data.earthHorizon} sample={sample} yawDeg={yawDeg} onYawChange={turnInstantly} animateTurn={animateTurn} />
        <div className="lp-side">
          <SelectionPanel datasets={datasets} datasetIndex={datasetIndex} onDataset={changeDataset}
            sampleIndex={sampleIndex} onSample={setSampleIndex}
            hardwarePresets={hardwarePresets} hardwareIndex={hardwareIndex} onHardware={setHardwareIndex} />
          <YawControl valueDeg={yawDeg} onChange={turn} />
          <LanderTopDown hardware={hardware} yawDeg={yawDeg} animateTurn={animateTurn} />
        </div>
      </div>
      <section className="lp-checks" aria-labelledby="lp-checks-h">
        <h2 id="lp-checks-h">Modeled checks at {yawDeg}°</h2>
        <div className="lp-cards">
          <ConstraintCard title="Solar power" result={ev?.solar ?? null} evidenceComplete={current.evidenceComplete} />
          <ConstraintCard title="Battery" result={ev?.battery ?? null} evidenceComplete={current.evidenceComplete} />
          <ConstraintCard title="Earth antenna" result={ev?.antenna ?? null} evidenceComplete={current.evidenceComplete} />
          <ConstraintCard title="Deployment (preliminary)" result={ev?.deployment ?? null} evidenceComplete={current.evidenceComplete} />
        </div>
        {ev && ev.unresolved.length > 0 && <div className="lp-unresolved"><h3>Unresolved inputs</h3><ul>{ev.unresolved.map(u => <li key={u}>{u}</li>)}</ul></div>}
        {!evaluate && <p className="lp-hint" role="status">Engine adapter not connected yet: all checks are Unknown.</p>}
      </section>
      <ComparisonTable alternatives={alternatives} yawDeg={yawDeg} />
    </main>
  );
}
