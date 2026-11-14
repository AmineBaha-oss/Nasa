"""Validate A305 Connecting Ridge Extension rasters and write the CRS-corrected 5 m slope.

Usage: python science/preprocess/prepare_a305.py <NASA_DATA_DIR>
"""
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
import rasterio

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / 'data/provenance/DATA_MANIFEST.json'
ORIGINALS = {
    'A305_GLDELEV_005.tif': 'A305_GLDELEV_005.tif',
    'A305_GLDMASK_005.tif': 'A305_GLDMASK_005.tif',
    'A305_GLDBRES_005.tif': 'A305_GLDBRES_005.tif',
    'A305_GLDSIGM_005.tif': 'A305_GLDSIGM_005.tif',
    'A305_GLDTSLP_005_005.tif': 'SLOPE_MAPS/A305_GLDTSLP_005_005.tif',
}
DERIVED_NAME = 'A305_GLDTSLP_005_005_lunar_crs.tif'


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def check_grid(path: Path, expected: dict) -> list[str]:
    errors = []
    with rasterio.open(path) as src:
        if (src.width, src.height) != (expected['width'], expected['height']):
            errors.append(f'size {src.width}x{src.height}')
        if not np.allclose(list(src.transform)[:6], expected['transform']):
            errors.append(f'transform {list(src.transform)[:6]}')
        if (src.crs is not None) != expected['crs_present']:
            errors.append(f'crs_present {src.crs is not None}')
    return errors


def main(data_dir: Path) -> int:
    files = {f['name']: f for f in json.loads(MANIFEST.read_text())['files']}
    failed = False
    for name, rel in ORIGINALS.items():
        path = data_dir / rel
        expected = files[name]
        errors = check_grid(path, expected)
        if path.stat().st_size != expected['bytes'] or sha256(path) != expected['sha256']:
            errors.append('bytes/sha256 mismatch')
        print(f"{name}: {'OK' if not errors else 'FAIL ' + '; '.join(errors)}")
        failed |= bool(errors)
    if failed:
        return 1

    dem_path = data_dir / ORIGINALS['A305_GLDELEV_005.tif']
    slope_path = data_dir / ORIGINALS['A305_GLDTSLP_005_005.tif']
    out_path = data_dir / 'derived' / DERIVED_NAME
    out_path.parent.mkdir(exist_ok=True)
    with rasterio.open(dem_path) as dem, rasterio.open(slope_path) as slope:
        profile = slope.profile.copy()
        profile.update(crs=dem.crs, compress='deflate', predictor=3, tiled=True, blockxsize=256, blockysize=256)
        values = slope.read()
        with rasterio.open(out_path, 'w', **profile) as dst:
            dst.write(values)
    with rasterio.open(slope_path) as slope, rasterio.open(out_path) as out:
        same = (
            out.transform == slope.transform
            and (out.width, out.height) == (slope.width, slope.height)
            and out.nodata == slope.nodata
            and out.crs is not None
            and np.array_equal(out.read(), slope.read(), equal_nan=True)
        )
    print(f'{DERIVED_NAME}: {"OK" if same else "FAIL"} sha256={sha256(out_path)} bytes={out_path.stat().st_size}')
    return 0 if same else 1


if __name__ == '__main__':
    sys.exit(main(Path(sys.argv[1])))
