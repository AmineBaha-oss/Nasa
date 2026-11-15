import type { SiteDateData } from '../contracts';
import type { CameraMode, SceneLayers } from '../scene3d/types';
import { DEFAULT_LAYERS } from '../scene3d/types';
import type { NavigatorState, PlaySpeed, ViewMode } from './navigatorState';
import { wrapYaw } from './navigatorState';

export interface ParsedHash {
  siteId?: string;
  windowHint?: 'a' | 'b';
  sampleIndex?: number;
  hardwareIndex?: number;
  yawDeg?: number;
  view?: ViewMode;
  cameraMode?: CameraMode;
  layers?: Partial<SceneLayers>;
}

const LAYER_KEYS = Object.keys(DEFAULT_LAYERS) as (keyof SceneLayers)[];

function parseBool(v: string | null): boolean | undefined {
  if (v === '1' || v === 'true') return true;
  if (v === '0' || v === 'false') return false;
  return undefined;
}

/** Parse `#site=site-2&win=a&t=37&hw=2&yaw=135&view=3d` into partial state. Invalid values are ignored. */
export function parseHash(hash: string): ParsedHash {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw) return {};
  const q = new URLSearchParams(raw.includes('=') ? raw : '');
  const out: ParsedHash = {};
  const site = q.get('site');
  if (site && /^site-\d+$/.test(site)) out.siteId = site;
  const win = q.get('win');
  if (win === 'a' || win === 'b') out.windowHint = win;
  const t = Number(q.get('t'));
  if (Number.isInteger(t) && t >= 0) out.sampleIndex = t;
  const hw = Number(q.get('hw'));
  if (Number.isInteger(hw) && hw >= 0) out.hardwareIndex = hw;
  const yaw = Number(q.get('yaw'));
  if (Number.isFinite(yaw)) out.yawDeg = wrapYaw(yaw);
  const view = q.get('view');
  if (view === '2d' || view === '3d') out.view = view;
  const cam = q.get('cam');
  if (cam === 'orbit' || cam === 'lander' || cam === 'top' || cam === 'hardware') out.cameraMode = cam;
  const layers: Partial<SceneLayers> = {};
  for (const key of LAYER_KEYS) {
    const b = parseBool(q.get(`L${key}`));
    if (b !== undefined) layers[key] = b;
  }
  if (Object.keys(layers).length) out.layers = layers;
  return out;
}

export function resolveDatasetIndex(datasets: SiteDateData[], parsed: ParsedHash, fallback = 0): number {
  if (!parsed.siteId) return fallback;
  const matches = datasets.map((d, i) => ({ d, i })).filter(x => x.d.site.id === parsed.siteId);
  if (matches.length === 0) return fallback;
  if (parsed.windowHint) {
    const hit = matches.find(x => x.d.samples[0]?.utc.includes(parsed.windowHint === 'a' ? '2027-10-10' : '2027-10-24'));
    if (hit) return hit.i;
  }
  return matches[0].i;
}

export function windowHintFor(data: SiteDateData): 'a' | 'b' {
  return data.samples[0]?.utc.startsWith('2027-10-24') ? 'b' : 'a';
}

/** Serialize navigator state into a shareable hash (no leading #). */
export function serializeHash(state: NavigatorState, data: SiteDateData): string {
  const q = new URLSearchParams();
  q.set('site', data.site.id);
  q.set('win', windowHintFor(data));
  q.set('t', String(state.sampleIndex));
  q.set('hw', String(state.hardwareIndex));
  q.set('yaw', String(state.yawDeg));
  q.set('view', state.view);
  if (state.cameraMode !== 'orbit') q.set('cam', state.cameraMode);
  for (const key of LAYER_KEYS) {
    if (state.layers[key] !== DEFAULT_LAYERS[key]) q.set(`L${key}`, state.layers[key] ? '1' : '0');
  }
  return q.toString();
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export const PLAY_SPEEDS: PlaySpeed[] = [1, 4, 12, 24];
