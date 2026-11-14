"""DEM sampling must treat masked pixels as unknown elevation."""
from pathlib import Path

import numpy as np
import pytest
import rasterio
from rasterio.transform import from_origin

from science.coords.lunar import stereographic_to_lonlat
from science.terrain.dem import sample_dem_elevation


def test_masked_finite_pixel_returns_none(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    dem = tmp_path / 'A305_GLDELEV_005.tif'
    transform = from_origin(-30000, -5000, 5, 5)
    data = np.full((4, 4), 1000.0, dtype=np.float32)
    # Finite stored value, but invalid mask at (1,1)
    mask = np.zeros((4, 4), dtype=bool)
    mask[1, 1] = True
    with rasterio.open(
        dem,
        'w',
        driver='GTiff',
        height=4,
        width=4,
        count=1,
        dtype='float32',
        crs=None,
        transform=transform,
        nodata=None,
    ) as dst:
        dst.write(data, 1)
        dst.write_mask(np.where(mask, 0, 255).astype('uint8'))

    monkeypatch.setenv('NASA_DATA_DIR', str(tmp_path))
    # Center of pixel (1,1): x = -30000 + 5*1.5, y = -5000 - 5*1.5
    easting = -30000 + 7.5
    northing = -5000 - 7.5
    lon, lat = stereographic_to_lonlat(easting, northing)
    sample = sample_dem_elevation(lon, lat)
    assert sample.inside_raster
    assert sample.elevation_m is None
