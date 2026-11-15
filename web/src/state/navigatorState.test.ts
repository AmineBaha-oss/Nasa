import { describe, expect, it } from 'vitest';
import { DEFAULT_LAYERS } from '../scene3d/types';
import { clampIndex, createInitialState, navigatorReducer, wrapYaw } from './navigatorState';
import { parseHash, resolveDatasetIndex, serializeHash } from './urlHash';
import type { SiteDateData } from '../contracts';

describe('navigatorReducer', () => {
  it('wraps yaw to [0, 360)', () => {
    expect(wrapYaw(360)).toBe(0);
    expect(wrapYaw(-1)).toBe(359);
    expect(wrapYaw(90.4)).toBe(90);
    let s = createInitialState({ yawDeg: 359 });
    s = navigatorReducer(s, { type: 'nudgeYaw', delta: 2 });
    expect(s.yawDeg).toBe(1);
  });

  it('clamps sample index when the dataset changes', () => {
    let s = createInitialState({ sampleIndex: 50 });
    s = navigatorReducer(s, { type: 'setDataset', index: 2, sampleCount: 10 });
    expect(s.datasetIndex).toBe(2);
    expect(s.sampleIndex).toBe(0);
    s = navigatorReducer(s, { type: 'setSample', index: 99, sampleCount: 10 });
    expect(s.sampleIndex).toBe(9);
    expect(clampIndex(-3, 5)).toBe(0);
  });

  it('toggles layers and view without losing other state', () => {
    let s = createInitialState({ yawDeg: 45 });
    s = navigatorReducer(s, { type: 'toggleLayer', key: 'skyline' });
    expect(s.layers.skyline).toBe(!DEFAULT_LAYERS.skyline);
    s = navigatorReducer(s, { type: 'toggleView' });
    expect(s.view).toBe('3d');
    expect(s.yawDeg).toBe(45);
  });
});

describe('url hash', () => {
  const fake = (id: string, start: string): SiteDateData => ({
    schemaVersion: '1.0', purpose: 'research', provenance: [],
    site: { id, name: id, latitudeDeg: -89, longitudeEastDeg: -100, terrainSource: 't', terrainCoverageKm: 300, label: 'x' },
    samples: [{ utc: start, sun: null, earth: null, ephemerisQuality: 'approximate', sourceId: null }],
    sunHorizon: { observerHeightM: 2, azimuthStepDeg: 90, anglesDeg: [0, 0, 0, 0], extentKm: 1, horizonCoverage: 'local-only', sourceId: null },
    earthHorizon: { observerHeightM: 3, azimuthStepDeg: 90, anglesDeg: [0, 0, 0, 0], extentKm: 1, horizonCoverage: 'local-only', sourceId: null },
  });

  it('parses a demo link and ignores junk', () => {
    const p = parseHash('#site=site-2&win=b&t=37&hw=2&yaw=135&view=3d&cam=top&bogus=1');
    expect(p).toMatchObject({ siteId: 'site-2', windowHint: 'b', sampleIndex: 37, hardwareIndex: 2, yawDeg: 135, view: '3d', cameraMode: 'top' });
    expect(parseHash('#yaw=999').yawDeg).toBe(279);
    expect(parseHash('#view=vr').view).toBeUndefined();
  });

  it('resolves site + window against the dataset list', () => {
    const datasets = [fake('site-1', '2027-10-10T00:00:00Z'), fake('site-2', '2027-10-10T00:00:00Z'), fake('site-2', '2027-10-24T00:00:00Z')];
    expect(resolveDatasetIndex(datasets, { siteId: 'site-2', windowHint: 'b' })).toBe(2);
    expect(resolveDatasetIndex(datasets, { siteId: 'site-9' })).toBe(0);
  });

  it('round-trips serialize → parse for the main fields', () => {
    const data = fake('site-3', '2027-10-24T00:00:00Z');
    const state = { ...createInitialState({ yawDeg: 200, view: '3d' }), sampleIndex: 12, hardwareIndex: 1, cameraMode: 'hardware' as const };
    const again = parseHash(serializeHash(state, data));
    expect(again).toMatchObject({ siteId: 'site-3', windowHint: 'b', sampleIndex: 12, hardwareIndex: 1, yawDeg: 200, view: '3d', cameraMode: 'hardware' });
  });
});
