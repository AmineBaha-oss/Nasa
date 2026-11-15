import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createEvaluator } from '../integration/evaluate';
import { HARDWARE_PRESETS } from '../integration/hardware';
import { loadMissionData, type MissionData } from '../integration/loader';
import { NavigatorPage } from '../pages/NavigatorPage';

type State = { kind: 'loading' } | { kind: 'ready'; data: MissionData } | { kind: 'error'; message: string };
const PRESETS = [...HARDWARE_PRESETS];

export function Shell({ title, children }: { title: string; children?: ReactNode }) {
  return <main className="lp-shell"><p className="eyebrow">LANDERPRINT · RESEARCH PROTOTYPE</p>
    <h1>Lunar Landing Site Navigator</h1>
    <section aria-labelledby="lp-shell-status"><h2 id="lp-shell-status">{title}</h2>{children}</section>
    <p>No mission predictions are shown without validated science data. This educational prototype does not certify landing safety.</p>
  </main>;
}

export function LoadProblems({ problems }: { problems: string[] }) {
  if (problems.length === 0) return null;
  return <details className="lp-load-problems" role="status">
    <summary>{problems.length} data file issue{problems.length === 1 ? '' : 's'}: affected results are left out or shown as unknown</summary>
    <ul>{problems.map(p => <li key={p}>{p}</li>)}</ul>
  </details>;
}

export function MissionView({ data }: { data: MissionData }) {
  const evaluate = useMemo(() => createEvaluator(data.terrainBySite), [data]);
  if (data.datasets.length === 0) {
    return <Shell title="No valid science data"><ul>{data.problems.map(p => <li key={p}>{p}</li>)}</ul></Shell>;
  }
  return <>
    <LoadProblems problems={data.problems} />
    <NavigatorPage
      datasets={data.datasets}
      hardwarePresets={PRESETS}
      evaluate={evaluate}
      initialYawDeg={0}
      terrainBySite={data.terrainBySite}
    />
  </>;
}

export function App() {
  const [state, setState] = useState<State>({ kind: 'loading' });
  useEffect(() => {
    let live = true;
    loadMissionData(`${import.meta.env.BASE_URL}data/`)
      .then(data => { if (live) setState({ kind: 'ready', data }); })
      .catch((e: unknown) => { if (live) setState({ kind: 'error', message: e instanceof Error ? e.message : String(e) }); });
    return () => { live = false; };
  }, []);
  if (state.kind === 'loading') return <Shell title="Loading processed science data…" />;
  if (state.kind === 'error') {
    return <Shell title="Science data could not be loaded"><p>{state.message}</p>
      <p>Run <code>npm run sync-data</code> in <code>web/</code> after the science build.</p></Shell>;
  }
  return <MissionView data={state.data} />;
}
