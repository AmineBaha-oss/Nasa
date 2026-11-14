"""Sample A305 DEM elevations by lunar lon/lat with path confinement."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import rasterio

from science.coords.lunar import lonlat_to_stereographic
from science.io.paths import confined_path, resolve_nasa_data_dir

DEFAULT_DEM_NAME = 'A305_GLDELEV_005.tif'


@dataclass(frozen=True)
class DemSample:
    longitude_east_deg: float
    latitude_deg: float
    easting_m: float
    northing_m: float
    elevation_m: float | None
    inside_raster: bool
    dem_path: str


def sample_dem_elevation(
    longitude_east_deg: float,
    latitude_deg: float,
    *,
    dem_relative: str = DEFAULT_DEM_NAME,
    data_dir: Path | None = None,
) -> DemSample:
    """Return DEM elevation at a lon/lat, or None elevation if out of coverage/nodata."""
    root = data_dir if data_dir is not None else resolve_nasa_data_dir()
    dem_path = confined_path(dem_relative, root)
    easting, northing = lonlat_to_stereographic(longitude_east_deg, latitude_deg)
    with rasterio.open(dem_path) as src:
        row, col = rasterio.transform.rowcol(src.transform, easting, northing)
        inside = 0 <= row < src.height and 0 <= col < src.width
        if not inside:
            return DemSample(
                longitude_east_deg,
                latitude_deg,
                easting,
                northing,
                None,
                False,
                str(dem_path),
            )
        sampled = list(src.sample([(easting, northing)], masked=True))[0]
        band = sampled[0]
        if np.ma.is_masked(band):
            elev = None
        else:
            value = float(band)
            nodata = src.nodata
            if nodata is not None and value == nodata:
                elev = None
            elif not np.isfinite(value):
                elev = None
            else:
                elev = value
        return DemSample(
            longitude_east_deg,
            latitude_deg,
            easting,
            northing,
            elev,
            True,
            str(dem_path),
        )
