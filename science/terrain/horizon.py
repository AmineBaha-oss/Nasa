"""Local DEM horizon profiles (local-only; distant terrain unmodeled)."""

from __future__ import annotations

import math
from pathlib import Path

import numpy as np
import rasterio

from science.coords.lunar import LUNAR_RADIUS_M, lonlat_to_stereographic
from science.geometry.frames import az_el_to_enu
from science.io.paths import confined_path, resolve_nasa_data_dir
from science.terrain.dem import DEFAULT_DEM_NAME


def compute_local_horizon(
    longitude_east_deg: float,
    latitude_deg: float,
    *,
    observer_height_m: float,
    azimuth_step_deg: float = 5.0,
    extent_km: float = 5.0,
    dem_relative: str = DEFAULT_DEM_NAME,
    data_dir: Path | None = None,
    step_m: float = 25.0,
) -> dict:
    """Ray-march the local DEM to build a horizon elevation profile.

    Returns a HorizonProfile-compatible dict with coverage ``local-only``.
    Distant terrain beyond the DEM / extent is unmodeled.
    """
    if azimuth_step_deg <= 0 or 360.0 % azimuth_step_deg != 0:
        raise ValueError('azimuth_step_deg must be a positive divisor of 360')
    if observer_height_m < 0:
        raise ValueError('observer_height_m must be >= 0')

    root = data_dir if data_dir is not None else resolve_nasa_data_dir()
    dem_path = confined_path(dem_relative, root)
    origin_e, origin_n = lonlat_to_stereographic(longitude_east_deg, latitude_deg)
    n_bins = int(round(360.0 / azimuth_step_deg))
    max_range_m = extent_km * 1000.0
    angles: list[float | None] = []

    with rasterio.open(dem_path) as src:
        band = src.read(1, masked=True)
        transform = src.transform
        nodata = src.nodata

        def elev_at(easting: float, northing: float) -> float | None:
            row, col = rasterio.transform.rowcol(transform, easting, northing)
            if not (0 <= row < src.height and 0 <= col < src.width):
                return None
            value = float(band[row, col])
            if nodata is not None and value == nodata:
                return None
            if not np.isfinite(value):
                return None
            return value

        origin_elev = elev_at(origin_e, origin_n)
        if origin_elev is None:
            return {
                'observerHeightM': observer_height_m,
                'azimuthStepDeg': azimuth_step_deg,
                'anglesDeg': [],
                'extentKm': 0.0,
                'horizonCoverage': 'missing',
                'sourceId': None,
            }

        observer_up = origin_elev + observer_height_m
        for i in range(n_bins):
            az = i * azimuth_step_deg
            east_u, north_u, _ = az_el_to_enu(az, 0.0)
            max_el = -90.0
            saw_terrain = False
            distance = step_m
            while distance <= max_range_m:
                sample_e = origin_e + east_u * distance
                sample_n = origin_n + north_u * distance
                sample_elev = elev_at(sample_e, sample_n)
                if sample_elev is None:
                    break
                saw_terrain = True
                # Approximate lunar curvature drop relative to local tangent.
                curve_m = (distance * distance) / (2.0 * LUNAR_RADIUS_M)
                rise = (sample_elev - curve_m) - observer_up
                el = math.degrees(math.atan2(rise, distance))
                if el > max_el:
                    max_el = el
                distance += step_m
            angles.append(max_el if saw_terrain else None)

    return {
        'observerHeightM': observer_height_m,
        'azimuthStepDeg': azimuth_step_deg,
        'anglesDeg': angles,
        'extentKm': extent_km,
        'horizonCoverage': 'local-only',
        'sourceId': 'a305-dem-local',
    }
