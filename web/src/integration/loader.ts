import type { SiteDateData, SiteTerrain } from '../contracts';
import { checkSiteDateData, checkSiteTerrain, type Checked } from './validate';

/** web/public/data/index.json, written by web/scripts/sync-data.mjs from data/processed. */
export interface DataIndex {
  schemaVersion: '1.0';
  generatedUtc: string;
  datasets: { file: string; sha256: string }[];
  terrain: { file: string; sha256: string }[];
}

export interface MissionData {
  datasets: SiteDateData[];
  terrainBySite: Map<string, SiteTerrain>;
  /** Files that were rejected or could not be checked; shown to the user, never silently dropped. */
  problems: string[];
}

type Fetch = (url: string) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

async function sha256Hex(text: string): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function fetchChecked<T>(base: string, entry: { file: string; sha256: string }, fetchFn: Fetch,
  check: (x: unknown, file: string) => Checked<T>, problems: string[]): Promise<T | null> {
  let text: string;
  try {
    const res = await fetchFn(base + entry.file);
    if (!res.ok) { problems.push(`${entry.file}: HTTP ${res.status}`); return null; }
    text = await res.text();
  } catch (e) {
    problems.push(`${entry.file}: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
  const hash = await sha256Hex(text);
  if (hash === null) problems.push(`${entry.file}: SHA-256 not checked (Web Crypto unavailable in this context)`);
  else if (hash !== entry.sha256) { problems.push(`${entry.file}: SHA-256 differs from data/index.json; file rejected`); return null; }
  let json: unknown;
  try { json = JSON.parse(text); } catch { problems.push(`${entry.file}: invalid JSON`); return null; }
  const checked = check(json, entry.file);
  if (!checked.ok) { problems.push(...checked.problems); return null; }
  return checked.value;
}

/** Loads every processed file listed in the index; invalid files are reported and left out. */
export async function loadMissionData(baseUrl: string, fetchFn: Fetch = (url: string) => fetch(url)): Promise<MissionData> {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const problems: string[] = [];
  const res = await fetchFn(`${base}index.json`);
  if (!res.ok) throw new Error(`data/index.json: HTTP ${res.status}`);
  const index = JSON.parse(await res.text()) as DataIndex;
  if (index.schemaVersion !== '1.0' || !Array.isArray(index.datasets) || !Array.isArray(index.terrain)) {
    throw new Error('data/index.json is not a v1.0 data index');
  }
  const [datasets, terrain] = await Promise.all([
    Promise.all(index.datasets.map(e => fetchChecked(base, e, fetchFn, checkSiteDateData, problems))),
    Promise.all(index.terrain.map(e => fetchChecked(base, e, fetchFn, checkSiteTerrain, problems))),
  ]);
  const terrainBySite = new Map<string, SiteTerrain>();
  for (const t of terrain) {
    if (!t) continue;
    if (terrainBySite.has(t.siteId)) problems.push(`Duplicate terrain patch for ${t.siteId}; first one kept`);
    else terrainBySite.set(t.siteId, t);
  }
  const loaded = datasets.filter((d): d is SiteDateData => d !== null);
  for (const d of loaded) {
    if (!terrainBySite.has(d.site.id)) problems.push(`${d.site.id}: no terrain patch; deployment stays unknown`);
  }
  return { datasets: loaded, terrainBySite, problems: [...new Set(problems)] };
}
