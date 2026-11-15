"""Cut small A305 DEM and 5 m slope patches around each site for the deployment screen.

Usage: python -m landerprint_science.patches
Writes data/processed/terrain/<site>.json (SiteTerrain, web/src/contracts/index.ts).
"""
from __future__ import annotations

import datetime as dt
import json
import sys
from pathlib import Path

import numpy as np
import rasterio
from rasterio.windows import Window

from . import export, frame
from .config import A305_DEM, A305_DIR, PROCESSED, REPO_URL, ROOT, SITES
from .terrain import check_projection

A305_SLOPE = A305_DIR / 'derived/A305_GLDTSLP_005_005_lunar_crs.tif'
TERRAIN_DIR = PROCESSED / 'terrain'
HALF_SIZE_M = 200.0
DECIMALS = 3
DEM_RANGE = (-1e5, 1e5)
SLOPE_RANGE = (0.0, 90.0)


def cut(path: Path, source_id: str, x: float, y: float, valid: tuple[float, float]) -> dict:
    """Pixel-aligned window around (x, y), clipped to the raster; missing pixels are None, never 0."""
    with rasterio.open(path) as src:
        check_projection(src.crs)
        t = src.transform
        if t.b or t.d or t.e != -t.a:
            raise ValueError(f'{path.name} is not a north-up square-pixel grid')
        px = t.a
        col0 = int(np.floor((x - HALF_SIZE_M - t.c) / px))
        row0 = int(np.floor((t.f - (y + HALF_SIZE_M)) / px))
        n = int(round(2 * HALF_SIZE_M / px))
        window = Window(col0, row0, n, n).intersection(Window(0, 0, src.width, src.height))
        data = src.read(1, window=window, masked=True)
        wt = src.window_transform(window)
    values = np.asarray(data.astype(np.float64).filled(np.nan))
    values[~np.isfinite(values) | (np.abs(values) >= 3e38) | (values < valid[0]) | (values > valid[1])] = np.nan
    flat = [None if np.isnan(v) else round(float(v), DECIMALS) for v in values.ravel()]
    return {'sourceId': source_id, 'originXM': float(wt.c), 'originYM': float(wt.f), 'pixelSizeM': float(wt.a),
            'width': int(values.shape[1]), 'height': int(values.shape[0]), 'values': flat, 'nodata': None}


def provenance(generated: str) -> list[dict]:
    records = export.input_records(generated)
    code = ROOT / 'science/landerprint_science/patches.py'
    records['terrain-patch'] = {
        'filename': 'science/landerprint_science/patches.py',
        'url': f'{REPO_URL}/blob/main/science/landerprint_science/patches.py',
        'sourceVersion': f'Pixel-aligned {2 * HALF_SIZE_M:.0f} m windows of a305-elev and a305-slope-5m, '
                         f'values rounded to {DECIMALS} decimals, missing pixels null',
        'sha256': export.sha256(code), 'generatedUtc': generated,
    }
    keep = ('a305-elev', 'a305-slope-5m', 'terrain-patch')
    return [{'id': rid, **records[rid]} for rid in keep]


def site_terrain(site: dict, generated: str) -> dict:
    x, y = (float(v) for v in frame.to_map(site['latitudeDeg'], site['longitudeEastDeg']))
    return {
        'schemaVersion': '1.0',
        'purpose': 'research',
        'siteId': site['id'],
        'provenance': provenance(generated),
        'dem': cut(A305_DEM, 'a305-elev', x, y, DEM_RANGE),
        'slope5m': cut(A305_SLOPE, 'a305-slope-5m', x, y, SLOPE_RANGE),
    }


def write_all(generated: str) -> list[Path]:
    TERRAIN_DIR.mkdir(parents=True, exist_ok=True)
    out = []
    for site in SITES:
        path = TERRAIN_DIR / f'{site["id"]}.json'
        path.write_text(json.dumps(site_terrain(site, generated), separators=(',', ':')) + '\n')
        out.append(path)
    return out


def main() -> int:
    generated = export.utc_stamp(dt.datetime.now(dt.UTC))
    for path in write_all(generated):
        data = json.loads(path.read_text())
        missing = sum(v is None for v in data['dem']['values']) + sum(v is None for v in data['slope5m']['values'])
        print(f'{export.rel(path)}: dem {data["dem"]["width"]}x{data["dem"]["height"]}, '
              f'slope {data["slope5m"]["width"]}x{data["slope5m"]["height"]}, {missing} missing pixels')
    return 0


if __name__ == '__main__':
    sys.exit(main())
