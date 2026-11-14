"""Rank flat, image-covered A305 cells as candidate demo sites.

A cell qualifies when every 5 m slope within a square of +/-BUFFER_M is below
SLOPE_LIMIT_DEG, at least MIN_COVERED of the surrounding 15 m mask cells have
one or more contributing images, and it lies EDGE_MIN_M from the tile edge.
This is a preliminary 5 m screen, not a landing-safety assessment.

Usage: python science/preprocess/find_sites.py [NASA_DATA_DIR]
"""
import json
import os
import sys
from pathlib import Path

import numpy as np
import rasterio
from pyproj import CRS, Transformer

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DIR = ROOT / 'data/nasa_a305/A3CLR22_5_Connecting_Ridge_Extension'
MOON_GEOG = CRS.from_proj4('+proj=longlat +R=1737400 +no_defs')
SLOPE_LIMIT_DEG = 8.0
BUFFER_M = 100.0
MIN_COVERED = 0.9
EDGE_MIN_M = 2000.0
SEPARATION_M = 1000.0
TOP_N = 20


def box_sum(a: np.ndarray, r: int) -> np.ndarray:
    c = np.pad(a, ((1, 0), (1, 0))).cumsum(0).cumsum(1)
    p = np.pad(c, r, mode='edge')
    n = 2 * r + 1
    return p[n:, n:] - p[:-n, n:] - p[n:, :-n] + p[:-n, :-n]


def main(data_dir: Path) -> None:
    with rasterio.open(data_dir / 'derived/A305_GLDTSLP_005_005_lunar_crs.tif') as s:
        slope = s.read(1, masked=True)
        t = s.transform
        crs = s.crs
    rows, cols = np.indices(slope.shape)
    xs = t.c + (cols + 0.5) * t.a
    ys = t.f + (rows + 0.5) * t.e

    r = int(BUFFER_M / t.a)
    steep = (slope.filled(90) >= SLOPE_LIMIT_DEG).astype(np.int32)
    flat_box = box_sum(steep, r)[: slope.shape[0], : slope.shape[1]] == 0

    with rasterio.open(data_dir / 'A305_GLDMASK_005.tif') as m:
        mask = m.read(1)
        mr, mc = rasterio.transform.rowcol(m.transform, xs.ravel(), ys.ravel())
    mr = np.clip(np.asarray(mr), 0, mask.shape[0] - 1).reshape(slope.shape)
    mc = np.clip(np.asarray(mc), 0, mask.shape[1] - 1).reshape(slope.shape)
    covered = (mask[mr, mc] >= 1).astype(np.float64)
    covered_frac = box_sum(covered, r)[: slope.shape[0], : slope.shape[1]] / (2 * r + 1) ** 2

    with rasterio.open(data_dir / 'A305_GLDELEV_005.tif') as d:
        b = d.bounds
        er, ec = rasterio.transform.rowcol(d.transform, xs.ravel(), ys.ravel())
        elev = d.read(1)[np.asarray(er), np.asarray(ec)].reshape(slope.shape)
    edge = np.minimum.reduce([xs - b.left, b.right - xs, ys - b.bottom, b.top - ys])

    ok = flat_box & (covered_frac >= MIN_COVERED) & (edge >= EDGE_MIN_M) & ~slope.mask
    print(f'qualifying cells: {int(ok.sum())} of {ok.size}')

    order = np.argsort(-np.where(ok, elev, -np.inf), axis=None)
    to_ll = Transformer.from_crs(crs, MOON_GEOG, always_xy=True)
    picked = []
    for idx in order:
        if not ok.flat[idx] or len(picked) >= TOP_N:
            break
        x, y = float(xs.flat[idx]), float(ys.flat[idx])
        if any(np.hypot(x - p['eastingM'], y - p['northingM']) < SEPARATION_M for p in picked):
            continue
        lon, lat = to_ll.transform(x, y)
        picked.append({
            'latitudeDeg': round(lat, 6), 'longitudeEastDeg': round(lon, 6),
            'eastingM': x, 'northingM': y, 'elevationM': round(float(elev.flat[idx]), 2),
            'slope5mDeg': round(float(slope.flat[idx]), 2), 'edgeDistanceKm': round(float(edge.flat[idx]) / 1000, 2),
            'imageCoveredFraction': round(float(covered_frac.flat[idx]), 3),
        })
    print(json.dumps(picked, indent=2))


if __name__ == '__main__':
    main(Path(sys.argv[1] if len(sys.argv) > 1 else os.environ.get('NASA_DATA_DIR', DEFAULT_DIR)))
