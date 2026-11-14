"""Assemble SiteDateData records (web/src/contracts/index.ts) from ephemeris and horizon results."""
from __future__ import annotations

import datetime as dt
import hashlib
import json
from pathlib import Path

import numpy as np

from . import ephemeris, horizons_ref
from .config import (INPUTS_LOCK, KERNELS, LOLA, PANEL_HEIGHT_M, ANTENNA_HEIGHT_M, PROVENANCE, REPO_URL,
                     ROOT, SITE_LABEL, STEP_S)
from .horizon import Skyline

TOLERANCE_DEG = 0.01
A305_URL = 'https://zenodo.org/records/17954508'
HORIZONS_URL = 'https://ssd.jpl.nasa.gov/api/horizons.api'
TERRAIN_SOURCE = 'NASA A305 SfS 5 m DEM, nested with LOLA 80 m and 240 m south polar DEMs'
TARGETS = (('sun', 'SUN', PANEL_HEIGHT_M), ('earth', 'EARTH', ANTENNA_HEIGHT_M))


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def utc_stamp(when: dt.datetime) -> str:
    return when.astimezone(dt.UTC).strftime('%Y-%m-%dT%H:%M:%SZ')


def rel(path: Path) -> str:
    return path.resolve().relative_to(ROOT).as_posix()


def sky_diff(az1, el1, az2, el2):
    """Azimuth difference scaled to arc on the sky, and elevation difference (deg)."""
    d_el = np.abs(np.asarray(el1, float) - np.asarray(el2, float))
    wrapped = (np.asarray(az1, float) - np.asarray(az2, float) + 180.0) % 360.0 - 180.0
    return np.abs(wrapped) * np.cos(np.radians(np.asarray(el2, float))), d_el


def input_records(generated: str) -> dict:
    lock = json.loads(INPUTS_LOCK.read_text())
    a305 = json.loads((PROVENANCE / 'A305_DOWNLOAD.json').read_text())
    elev = next(o for o in a305['originals'] if o['path'] == 'A305_GLDELEV_005.tif')
    slope = a305['derived'][0]
    recs = {
        'a305-elev': {'filename': elev['path'], 'url': A305_URL, 'sourceVersion': 'Zenodo record 17954508 v1.0.0, CC BY 4.0',
                      'sha256': elev['sha256'], 'generatedUtc': a305['downloaded_utc']},
        'a305-slope-5m': {'filename': Path(slope['path']).name, 'url': A305_URL,
                          'sourceVersion': 'Zenodo record 17954508 v1.0.0; lunar CRS tag added, pixels unchanged',
                          'sha256': slope['sha256'], 'generatedUtc': a305['downloaded_utc']},
    }
    for entry in KERNELS + LOLA:
        rec = lock[entry['id']]
        recs[entry['id']] = {'filename': rec['filename'], 'url': rec['url'], 'sourceVersion': rec['filename'],
                             'sha256': rec['sha256'], 'generatedUtc': rec['retrievedUtc']}
    code = ROOT / 'science/landerprint_science'
    for rid, name, version in (
        ('spice-ephemeris', 'ephemeris.py', 'SPICE azlcpo in MOON_ME with LT+S, body centre; kernels '
         + ', '.join(k['id'] for k in KERNELS)),
        ('terrain-horizon', 'horizon.py', 'Ray-cast skyline over a305-elev, lola-80m, lola-240m; 0.25 deg rays, 1 deg bins'),
    ):
        recs[rid] = {'filename': f'science/landerprint_science/{name}',
                     'url': f'{REPO_URL}/blob/main/science/landerprint_science/{name}',
                     'sourceVersion': version, 'sha256': sha256(code / name), 'generatedUtc': generated}
    return recs


def profile(sky: Skyline) -> dict:
    return {'observerHeightM': sky.observer_height_m, 'azimuthStepDeg': 360.0 / len(sky.bins_deg),
            'anglesDeg': sky.bins_deg, 'extentKm': sky.extent_km,
            'horizonCoverage': 'far-field-validated' if sky.complete else 'local-only',
            'sourceId': 'terrain-horizon'}


def ephemeris_for(site: dict, window: dict, ground_m: float) -> tuple[list[str], dict, dict, dict]:
    """SPICE samples per target, Horizons checks and the reference provenance records."""
    utc = ephemeris.hourly_utc(window['startUtc'], window['stopUtc'], STEP_S)
    directions, checks, refs = {}, {}, {}
    for target, spice_name, height in TARGETS:
        site_km = ephemeris.site_position_km(site['latitudeDeg'], site['longitudeEastDeg'], ground_m + height)
        az, el = ephemeris.az_el(spice_name, utc, site_km)
        path = horizons_ref.reference_path(site['id'], window['id'], target)
        verified = np.zeros(len(utc), dtype=bool)
        check = {'samples': len(utc), 'matched': 0, 'withinTolerance': 0, 'observerHeightM': height}
        if path.exists():
            text = path.read_text(encoding='utf-8')
            ref = {row[0]: row[1:] for row in horizons_ref.parse(text)}
            idx = [i for i, u in enumerate(utc) if u in ref]
            ref_id = f'horizons-{site["id"]}-{window["id"]}-{target}'
            refs[ref_id] = {'filename': rel(path), 'url': HORIZONS_URL,
                            'sourceVersion': f'JPL Horizons API {horizons_ref.api_version(text)} (DE441), topocentric, airless',
                            'sha256': sha256(path),
                            'generatedUtc': utc_stamp(dt.datetime.fromtimestamp(path.stat().st_mtime, dt.UTC))}
            if idx:
                d_az, d_el = sky_diff(az[idx], el[idx], [ref[utc[i]][0] for i in idx], [ref[utc[i]][1] for i in idx])
                good = (d_az < TOLERANCE_DEG) & (d_el < TOLERANCE_DEG)
                verified[idx] = good
                check.update(matched=len(idx), withinTolerance=int(good.sum()),
                             maxAzSkyDeg=float(d_az.max()), meanAzSkyDeg=float(d_az.mean()),
                             maxElDeg=float(d_el.max()), meanElDeg=float(d_el.mean()), referenceId=ref_id)
        directions[target] = (az, el, verified)
        checks[target] = check
    return utc, directions, checks, refs


def site_date_data(site: dict, window: dict, sun_sky: Skyline, earth_sky: Skyline, generated: str) -> tuple[dict, dict]:
    utc, directions, checks, refs = ephemeris_for(site, window, sun_sky.ground_height_m)
    records = {**input_records(generated), **refs}
    samples = []
    for i, stamp in enumerate(utc):
        sample = {'utc': stamp}
        for target in ('sun', 'earth'):
            az, el, _ = directions[target]
            sample[target] = {'azDeg': round(float(az[i]), 5), 'elDeg': round(float(el[i]), 5)}
        verified = all(directions[t][2][i] for t in ('sun', 'earth'))
        sample['ephemerisQuality'] = 'jpl-verified' if verified else 'approximate'
        sample['sourceId'] = 'spice-ephemeris'
        samples.append(sample)
    data = {
        'schemaVersion': '1.0',
        'purpose': 'research',
        'provenance': [{'id': rid, **rec} for rid, rec in records.items()],
        'site': {'id': site['id'], 'name': site['name'], 'latitudeDeg': site['latitudeDeg'],
                 'longitudeEastDeg': site['longitudeEastDeg'], 'terrainSource': TERRAIN_SOURCE,
                 'terrainCoverageKm': sun_sky.extent_km, 'label': SITE_LABEL},
        'samples': samples,
        'sunHorizon': profile(sun_sky),
        'earthHorizon': profile(earth_sky),
        'slopeSourceId': 'a305-slope-5m',
    }
    return data, checks
