"""Screen candidate sites against the A305 rasters by projected coordinate.

Usage: python science/preprocess/screen_sites.py [NASA_DATA_DIR]
"""
import json
import os
import sys
from pathlib import Path

import numpy as np
import rasterio
from pyproj import CRS, Transformer
from rasterio.windows import from_bounds

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DIR = ROOT / 'data/nasa_a305/A3CLR22_5_Connecting_Ridge_Extension'
MOON_GEOG = CRS.from_proj4('+proj=longlat +R=1737400 +no_defs')
BUFFER_M = 100.0

CANDIDATES = [
    {'id': 'site-c', 'latitudeDeg': -89.111829, 'longitudeEastDeg': -102.713980},
    {'id': 'site-b', 'latitudeDeg': -89.207574, 'longitudeEastDeg': -92.952007},
]


def window_values(path: Path, x: float, y: float, radius: float) -> np.ndarray:
    with rasterio.open(path) as src:
        win = from_bounds(x - radius, y - radius, x + radius, y + radius, src.transform)
        data = src.read(1, window=win, masked=True).astype('float64')
        rows, cols = np.indices(data.shape)
        xs, ys = rasterio.transform.xy(src.window_transform(win), rows.ravel(), cols.ravel())
        dist = np.hypot(np.asarray(xs) - x, np.asarray(ys) - y).reshape(data.shape)
        return np.ma.masked_where(dist > radius, data).compressed()


def point_value(path: Path, x: float, y: float) -> float | None:
    with rasterio.open(path) as src:
        value = next(src.sample([(x, y)], masked=True))[0]
        return None if np.ma.is_masked(value) else float(value)


def screen(data_dir: Path) -> list[dict]:
    dem = data_dir / 'A305_GLDELEV_005.tif'
    slope = data_dir / 'derived/A305_GLDTSLP_005_005_lunar_crs.tif'
    with rasterio.open(dem) as src:
        to_xy = Transformer.from_crs(MOON_GEOG, src.crs, always_xy=True)
        bounds = src.bounds
    results = []
    for site in CANDIDATES:
        x, y = to_xy.transform(site['longitudeEastDeg'], site['latitudeDeg'])
        slopes = window_values(slope, x, y, BUFFER_M)
        results.append({
            **site,
            'eastingM': round(x, 1),
            'northingM': round(y, 1),
            'edgeDistanceKm': round(min(x - bounds.left, bounds.right - x, y - bounds.bottom, bounds.top - y) / 1000, 2),
            'elevationM': point_value(dem, x, y),
            'slope5mAtPointDeg': point_value(slope, x, y),
            'slope5mMaxWithin100mDeg': float(slopes.max()) if slopes.size else None,
            'maskImageCount': point_value(data_dir / 'A305_GLDMASK_005.tif', x, y),
            'bestImageResolutionM': point_value(data_dir / 'A305_GLDBRES_005.tif', x, y),
            'elevationSigmaM': point_value(data_dir / 'A305_GLDSIGM_005.tif', x, y),
        })
    return results


if __name__ == '__main__':
    data_dir = Path(sys.argv[1] if len(sys.argv) > 1 else os.environ.get('NASA_DATA_DIR', DEFAULT_DIR))
    print(json.dumps(screen(data_dir), indent=2))
