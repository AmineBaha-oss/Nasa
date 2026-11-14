"""DEM sampling and local-horizon helpers."""

from science.terrain.dem import DemSample, sample_dem_elevation
from science.terrain.horizon import compute_local_horizon

__all__ = ['DemSample', 'compute_local_horizon', 'sample_dem_elevation']
