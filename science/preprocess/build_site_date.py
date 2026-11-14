"""Build Gate-1 SiteDateData JSON for curated A305 sites and 2027 windows.

Usage (from repository root):
  set NASA_DATA_DIR to the A305 folder, then:
  python -m science.preprocess.build_site_date

Writes research JSON under data/processed/. Ephemeris from JPL Horizons.
Horizons are local DEM only (far-field still unknown / DATA-004).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from science.ephemeris.horizons import HorizonsError, fetch_az_el_series
from science.io.paths import resolve_nasa_data_dir, resolve_repo_data_root
from science.schema.site_date import validate_site_date_data
from science.sites.candidates import CANDIDATE_SITES, DATE_WINDOWS
from science.terrain.dem import sample_dem_elevation
from science.terrain.horizon import compute_local_horizon

REPO_ROOT = Path(__file__).resolve().parents[2]
PANEL_HEIGHT_M = 2.0
ANTENNA_HEIGHT_M = 3.0
AZIMUTH_STEP_DEG = 5.0
HORIZON_EXTENT_KM = 5.0


def _utc_now() -> str:
    return datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def _file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b''):
            digest.update(chunk)
    return digest.hexdigest()


def _merge_samples(sun_series, earth_series) -> list[dict]:
    earth_by_utc = {sample.utc: sample for sample in earth_series.samples}
    merged: list[dict] = []
    for sun in sun_series.samples:
        earth = earth_by_utc.get(sun.utc)
        if earth is None:
            merged.append(
                {
                    'utc': sun.utc,
                    'sun': {'azDeg': sun.az_deg, 'elDeg': sun.el_deg},
                    'earth': None,
                    'ephemerisQuality': 'approximate',
                    'sourceId': 'horizons-sun-earth',
                }
            )
            continue
        merged.append(
            {
                'utc': sun.utc,
                'sun': {'azDeg': sun.az_deg, 'elDeg': sun.el_deg},
                'earth': {'azDeg': earth.az_deg, 'elDeg': earth.el_deg},
                'ephemerisQuality': 'jpl-verified',
                'sourceId': 'horizons-sun-earth',
            }
        )
    return merged


def build_one(site, window, *, generated_utc: str, dem_sha: str, dem_path: Path) -> dict:
    dem = sample_dem_elevation(site.longitude_east_deg, site.latitude_deg)
    if not dem.inside_raster or dem.elevation_m is None:
        raise RuntimeError(f'site {site.id} is outside DEM coverage or nodata')

    sun = fetch_az_el_series(
        target='sun',
        longitude_east_deg=site.longitude_east_deg,
        latitude_deg=site.latitude_deg,
        altitude_km=0.0,
        start_utc=window.start_utc,
        stop_utc=window.stop_utc,
        step=window.step,
    )
    earth = fetch_az_el_series(
        target='earth',
        longitude_east_deg=site.longitude_east_deg,
        latitude_deg=site.latitude_deg,
        altitude_km=0.0,
        start_utc=window.start_utc,
        stop_utc=window.stop_utc,
        step=window.step,
    )

    sun_horizon = compute_local_horizon(
        site.longitude_east_deg,
        site.latitude_deg,
        observer_height_m=PANEL_HEIGHT_M,
        azimuth_step_deg=AZIMUTH_STEP_DEG,
        extent_km=HORIZON_EXTENT_KM,
    )
    earth_horizon = compute_local_horizon(
        site.longitude_east_deg,
        site.latitude_deg,
        observer_height_m=ANTENNA_HEIGHT_M,
        azimuth_step_deg=AZIMUTH_STEP_DEG,
        extent_km=HORIZON_EXTENT_KM,
    )

    payload = {
        'schemaVersion': '1.0',
        'purpose': 'research',
        'provenance': [
            {
                'id': 'horizons-sun-earth',
                'filename': 'horizons.api',
                'url': 'https://ssd.jpl.nasa.gov/horizons/',
                'sourceVersion': f'sun:{sun.sha256[:12]}|earth:{earth.sha256[:12]}',
                'sha256': hashlib.sha256(
                    (sun.raw_result + '\n' + earth.raw_result).encode('utf-8')
                ).hexdigest(),
                'generatedUtc': generated_utc,
            },
            {
                'id': 'a305-dem-local',
                'filename': dem_path.name,
                'url': 'https://doi.org/10.5281/zenodo.17954508',
                'sourceVersion': '1.0.0',
                'sha256': dem_sha,
                'generatedUtc': generated_utc,
            },
        ],
        'site': {
            'id': site.id,
            'name': site.name,
            'latitudeDeg': site.latitude_deg,
            'longitudeEastDeg': site.longitude_east_deg,
            'terrainSource': site.terrain_source,
            'terrainCoverageKm': site.terrain_coverage_km,
            'label': site.label,
        },
        'samples': _merge_samples(sun, earth),
        'sunHorizon': sun_horizon,
        'earthHorizon': earth_horizon,
    }
    return dict(validate_site_date_data(payload))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        '--out-dir',
        type=Path,
        default=None,
        help='Output directory (default: repository data/processed)',
    )
    args = parser.parse_args(argv)

    try:
        dem_path = resolve_nasa_data_dir(relative='A305_GLDELEV_005.tif')
    except Exception as exc:  # noqa: BLE001 - CLI surface
        print(f'NASA_DATA_DIR error: {exc}', file=sys.stderr)
        return 1

    if not dem_path.is_file():
        print(f'Missing DEM at {dem_path}', file=sys.stderr)
        return 1
    dem_sha = _file_sha256(dem_path)
    out_dir = args.out_dir or resolve_repo_data_root('processed')
    out_dir.mkdir(parents=True, exist_ok=True)
    generated_utc = _utc_now()

    written = 0
    for site in CANDIDATE_SITES:
        for window in DATE_WINDOWS:
            try:
                payload = build_one(
                    site,
                    window,
                    generated_utc=generated_utc,
                    dem_sha=dem_sha,
                    dem_path=dem_path,
                )
            except (HorizonsError, RuntimeError) as exc:
                print(f'FAIL {site.id}/{window.id}: {exc}', file=sys.stderr)
                return 1
            out_path = out_dir / f'{site.id}_{window.id}.json'
            out_path.write_text(json.dumps(payload, indent=2) + '\n', encoding='utf-8')
            try:
                display = out_path.resolve().relative_to(REPO_ROOT)
            except ValueError:
                display = out_path
            print(f'OK {display} samples={len(payload["samples"])}')
            written += 1

    print(
        f'Wrote {written} SiteDateData files. '
        'Ephemeris: jpl-verified via Horizons. Horizons: local-only (DATA-004 open).'
    )
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
