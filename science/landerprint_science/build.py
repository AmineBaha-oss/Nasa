"""Build SiteDateData JSON for every site and window, plus a validation report.

Usage: python -m landerprint_science.build
Needs python -m landerprint_science.kernels first; Horizons tables are in science/reference/horizons.
"""
from __future__ import annotations

import datetime as dt
import json
import sys

import numpy as np

from . import ephemeris, export, framecheck, frame, horizon, patches
from .config import (A305_DEM, ANTENNA_HEIGHT_M, HEIGHTS_ARE_HYPOTHETICAL, HORIZON_EXTENT_KM, LOLA, LOLA_DIR,
                     PANEL_HEIGHT_M, PROCESSED, SITES, WINDOWS)
from .terrain import Grid, TerrainStack


def load_terrain(sites: list[dict]) -> TerrainStack:
    xs, ys = frame.to_map([s['latitudeDeg'] for s in sites], [s['longitudeEastDeg'] for s in sites])
    reach = HORIZON_EXTENT_KM * 1000.0 + 2000.0
    box = (float(np.min(xs)) - reach, float(np.min(ys)) - reach, float(np.max(xs)) + reach, float(np.max(ys)) + reach)
    grids = [Grid.read(A305_DEM, 'a305-elev')]
    grids += [Grid.read(LOLA_DIR / entry['name'], entry['id'], bounds=box) for entry in LOLA]
    return TerrainStack(grids)


def horizon_summary(sky: horizon.Skyline) -> dict:
    known = [b for b in sky.bins_deg if b is not None]
    return {'observerHeightM': sky.observer_height_m, 'completeBins': len(known), 'bins': len(sky.bins_deg),
            'maxDeg': max(known) if known else None, 'minDeg': min(known) if known else None,
            'maxLimitingRangeKm': float(np.nanmax(sky.limiting_range_m)) / 1000.0, 'complete': sky.complete}


def main() -> int:
    generated = export.utc_stamp(dt.datetime.now(dt.UTC))
    frame_result = framecheck.run()
    framecheck.RESULT.write_text(json.dumps(frame_result, indent=2) + '\n')
    print(f"frame check: median offset {frame_result['medianOffsetM']:.2f} m, passed={frame_result['passed']}")
    if not frame_result['passed']:
        print('A305 and LOLA disagree; not building. See data/provenance/A305_FRAME_CHECK.json', file=sys.stderr)
        return 1

    ephemeris.furnish()
    stack = load_terrain(SITES)
    PROCESSED.mkdir(parents=True, exist_ok=True)
    report = {
        'generatedUtc': generated,
        'toleranceDeg': export.TOLERANCE_DEG,
        'heightsAreHypothetical': HEIGHTS_ARE_HYPOTHETICAL,
        'panelHeightM': PANEL_HEIGHT_M,
        'antennaHeightM': ANTENNA_HEIGHT_M,
        'ephemerisLimit': 'Horizons (DE441) and SPICE (DE440) are both JPL SSD products; agreement checks our frame, '
                          'time and site handling, not the planetary ephemeris itself.',
        'directionLimit': 'Directions are to the centre of the Sun and Earth; no finite disc.',
        'terrainLimit': 'A 5 m grid cannot resolve small landing or ramp hazards; bins with any missing terrain are null.',
        'frameCheck': {k: frame_result[k] for k in ('points', 'medianOffsetM', 'meanOffsetM', 'stdM', 'bestShift', 'passed')},
        'sites': [],
    }
    for site in SITES:
        lat, lon = site['latitudeDeg'], site['longitudeEastDeg']
        sun_sky = horizon.skyline(stack, lat, lon, PANEL_HEIGHT_M)
        earth_sky = horizon.skyline(stack, lat, lon, ANTENNA_HEIGHT_M)
        entry = {'id': site['id'], 'groundHeightM': round(sun_sky.ground_height_m, 2),
                 'sunHorizon': horizon_summary(sun_sky), 'earthHorizon': horizon_summary(earth_sky), 'windows': []}
        for window in WINDOWS:
            data, checks = export.site_date_data(site, window, sun_sky, earth_sky, generated)
            out = PROCESSED / f'{site["id"]}_{window["id"]}.json'
            out.write_text(json.dumps(data, indent=1) + '\n')
            verified = sum(s['ephemerisQuality'] == 'jpl-verified' for s in data['samples'])
            entry['windows'].append({'id': window['id'], 'file': export.rel(out), 'samples': len(data['samples']),
                                     'jplVerifiedSamples': verified, 'ephemerisCheck': checks,
                                     'sunHorizonCoverage': data['sunHorizon']['horizonCoverage'],
                                     'earthHorizonCoverage': data['earthHorizon']['horizonCoverage']})
            print(f'{out.name}: {verified}/{len(data["samples"])} jpl-verified, '
                  f'sun max err az {checks["sun"].get("maxAzSkyDeg", float("nan")):.5f} el {checks["sun"].get("maxElDeg", float("nan")):.5f}, '
                  f'earth az {checks["earth"].get("maxAzSkyDeg", float("nan")):.5f} el {checks["earth"].get("maxElDeg", float("nan")):.5f} deg, '
                  f'horizon {data["sunHorizon"]["horizonCoverage"]}')
        report['sites'].append(entry)
    for path in patches.write_all(generated):
        print(f'wrote {export.rel(path)}')
    (PROCESSED / 'validation_report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(f'wrote {PROCESSED / "validation_report.json"}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
