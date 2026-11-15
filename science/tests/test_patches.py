import json
import re

import numpy as np
import pytest
import rasterio

from landerprint_science import frame, patches
from landerprint_science.config import A305_DEM, SITES

GRID = {'sourceId', 'originXM', 'originYM', 'pixelSizeM', 'width', 'height', 'values', 'nodata'}
RASTERS = {'dem': A305_DEM, 'slope5m': patches.A305_SLOPE}


def load(site):
    path = patches.TERRAIN_DIR / f'{site["id"]}.json'
    if not path.exists():
        pytest.skip(f'{path.name} not built; run python -m landerprint_science.patches')
    return json.loads(path.read_text())


@pytest.mark.parametrize('site', SITES, ids=[s['id'] for s in SITES])
def test_contract_and_provenance(site):
    data = load(site)
    assert set(data) == {'schemaVersion', 'purpose', 'siteId', 'provenance', 'dem', 'slope5m'}
    assert data['schemaVersion'] == '1.0' and data['purpose'] == 'research' and data['siteId'] == site['id']
    known = {p['id']: p for p in data['provenance']}
    for key in RASTERS:
        grid = data[key]
        assert set(grid) == GRID
        assert len(grid['values']) == grid['width'] * grid['height']
        assert grid['sourceId'] in known and re.fullmatch(r'[0-9a-f]{64}', known[grid['sourceId']]['sha256'])
    assert data['dem']['sourceId'] == 'a305-elev' and data['slope5m']['sourceId'] == 'a305-slope-5m'


@pytest.mark.parametrize('site', SITES, ids=[s['id'] for s in SITES])
def test_site_centred_and_pixel_aligned(site):
    data = load(site)
    x, y = (float(v) for v in frame.to_map(site['latitudeDeg'], site['longitudeEastDeg']))
    for key, path in RASTERS.items():
        grid = data[key]
        with rasterio.open(path) as src:
            t = src.transform
        assert grid['pixelSizeM'] == t.a == 5.0
        assert ((grid['originXM'] - t.c) / t.a) % 1 == 0 and ((t.f - grid['originYM']) / t.a) % 1 == 0
        right = grid['originXM'] + grid['width'] * grid['pixelSizeM']
        bottom = grid['originYM'] - grid['height'] * grid['pixelSizeM']
        margin = min(x - grid['originXM'], right - x, grid['originYM'] - y, y - bottom)
        assert margin >= patches.HALF_SIZE_M - grid['pixelSizeM']


@pytest.mark.parametrize('site', SITES, ids=[s['id'] for s in SITES])
def test_values_match_raster_by_coordinate(site):
    data = load(site)
    rng = np.random.default_rng(7)
    for key, path in RASTERS.items():
        grid = data[key]
        rows = rng.integers(0, grid['height'], 200)
        cols = rng.integers(0, grid['width'], 200)
        xs = grid['originXM'] + (cols + 0.5) * grid['pixelSizeM']
        ys = grid['originYM'] - (rows + 0.5) * grid['pixelSizeM']
        with rasterio.open(path) as src:
            truth = np.array([v[0] for v in src.sample(zip(xs, ys))], dtype=np.float64)
        got = np.array([grid['values'][r * grid['width'] + c] for r, c in zip(rows, cols)], dtype=np.float64)
        assert np.all(np.abs(got - truth) <= 0.5 * 10 ** -patches.DECIMALS + 1e-9)


def test_missing_pixels_become_null_not_zero(tmp_path):
    src_path = tmp_path / 'synthetic.tif'
    profile = {'driver': 'GTiff', 'width': 4, 'height': 4, 'count': 1, 'dtype': 'float32', 'nodata': -3.4028234663852886e38,
               'crs': frame.SOUTH_POLAR_STEREO.to_wkt(), 'transform': rasterio.transform.from_origin(0, 20, 5, 5)}
    values = np.full((4, 4), 7.0, dtype=np.float32)
    values[1, 2] = profile['nodata']
    values[2, 1] = np.nan
    with rasterio.open(src_path, 'w', **profile) as dst:
        dst.write(values, 1)
    grid = patches.cut(src_path, 'synthetic', 10.0, 10.0, patches.DEM_RANGE)
    assert grid['width'] == grid['height'] == 4
    assert grid['values'][1 * 4 + 2] is None and grid['values'][2 * 4 + 1] is None
    assert sum(v is None for v in grid['values']) == 2 and 0 not in grid['values']


def test_window_is_clipped_at_raster_edge(tmp_path):
    src_path = tmp_path / 'edge.tif'
    profile = {'driver': 'GTiff', 'width': 10, 'height': 10, 'count': 1, 'dtype': 'float32', 'nodata': None,
               'crs': frame.SOUTH_POLAR_STEREO.to_wkt(), 'transform': rasterio.transform.from_origin(0, 50, 5, 5)}
    with rasterio.open(src_path, 'w', **profile) as dst:
        dst.write(np.ones((10, 10), dtype=np.float32), 1)
    grid = patches.cut(src_path, 'edge', 2.0, 48.0, patches.DEM_RANGE)
    assert grid['originXM'] == 0 and grid['originYM'] == 50
    assert len(grid['values']) == grid['width'] * grid['height'] == 100
