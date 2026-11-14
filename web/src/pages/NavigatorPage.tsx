import { useMemo, useState } from 'react';
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

  const hardware = hardwarePresets[hardwareIndex] ?? null;
  const alternatives = useMemo(() => datasets.map(data => ({
    data,
    evaluation: evaluate && hardware ? evaluate(data, hardware, yawDeg) : null,
    evidenceComplete: hasFullCoverageEvidence(data),
  })), [datasets, evaluate, hardware, yawDeg]);

  if (datasets.length === 0) {
    return <main className="lp-page"><h1>Lunar Landing Site Navigator</h1>
      <p role="status">No processed science data loaded. Results stay unknown until the science module delivers versioned JSON.</p></main>;
  }
  const current = alternatives[datasetIndex];
  const data = current.data;
  const sample = data.samples[Math.min(sampleIndex, data.samples.length - 1)] ?? null;
  const ev = current.evaluation;
  const changeDataset = (i: number) => { if (i >= 0) { setDatasetIndex(i); setSampleIndex(0); } };

  return (
    <main className="lp-page">
      <header className="lp-top">
        <p className="eyebrow">LANDERPRINT · RESEARCH PROTOTYPE</p>
        <h1>Lunar Landing Site Navigator</h1>
      </header>
      <DataQualityNotice data={data} hardware={hardware} />
      <div className="lp-grid">
        <div className="lp-controls">
          <SelectionPanel datasets={datasets} datasetIndex={datasetIndex} onDataset={changeDataset}
            sampleIndex={sampleIndex} onSample={setSampleIndex}
            hardwarePresets={hardwarePresets} hardwareIndex={hardwareIndex} onHardware={setHardwareIndex} />
          <YawControl valueDeg={yawDeg} onChange={setYawDeg} />
        </div>
        <HorizonWheel sunHorizon={data.sunHorizon} earthHorizon={data.earthHorizon} sample={sample} yawDeg={yawDeg} />
        <LanderTopDown hardware={hardware} yawDeg={yawDeg} />
      </div>
      <section aria-labelledby="lp-checks-h">
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
