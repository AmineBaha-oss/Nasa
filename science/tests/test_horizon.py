import numpy as np
import pytest
from affine import Affine

from landerprint_science import frame, horizon
from landerprint_science.terrain import Grid, TerrainStack

LAT, LON = -89.4, -100.0
SEGMENTS = [(5.0, 2_000.0, 5.0), (2_000.0, 40_000.0, 40.0)]
HALF_M, RES_M = 45_000.0, 50.0


def synthetic_grid(values_fn=None) -> Grid:
    x0, y0 = frame.to_map(LAT, LON)
    n = int(2 * HALF_M / RES_M)
    transform = Affine(RES_M, 0, float(x0) - HALF_M, 0, -RES_M, float(y0) + HALF_M)
    values = np.zeros((n, n), dtype=np.float32)
    if values_fn is not None:
        cols, rows = np.meshgrid(np.arange(n) + 0.5, np.arange(n) + 0.5)
        values_fn(values, transform.c + cols * RES_M, transform.f - rows * RES_M)
    return Grid(values, transform, 'synthetic')


def run(grid, height=2.0):
    return horizon.skyline(TerrainStack([grid]), LAT, LON, height, segments=SEGMENTS)


def test_smooth_sphere_matches_dip():
    for height in (2.0, 3.0):
        sky = run(synthetic_grid(), height)
        dip = -np.degrees(np.arccos(frame.R_MOON_M / (frame.R_MOON_M + height)))
        assert sky.complete
        assert np.allclose(sky.bins_deg, dip, atol=0.003)


def test_ridge_found_at_azimuth_and_distance():
    distance, ridge_h, az = 10_000.0, 400.0, 120.0
    rlat, rlon = frame.travel(LAT, LON, az, distance)
    rx, ry = frame.to_map(rlat, rlon)

    def ridge(values, x, y):
        values[np.hypot(x - rx, y - ry) < 300.0] = ridge_h

    sky = run(synthetic_grid(ridge))
    peak = int(np.argmax(sky.bins_deg))
    assert abs(peak - az) <= 2
    expected = np.degrees(np.arctan2(ridge_h - 2.0, distance)) - np.degrees(distance / (2 * frame.R_MOON_M))
    assert sky.bins_deg[int(az)] == pytest.approx(expected, abs=0.1)
    at_peak = np.argmax(sky.fine_elev_deg)
    assert sky.limiting_range_m[at_peak] == pytest.approx(distance, abs=400.0)
    assert sky.bins_deg[int((az + 180) % 360)] < 0


def test_missing_terrain_gives_null_not_clear_sky():
    hole_lat, hole_lon = frame.travel(LAT, LON, 90.0, 5_000.0)
    hx, hy = frame.to_map(hole_lat, hole_lon)

    def hole(values, x, y):
        values[np.hypot(x - hx, y - hy) < 500.0] = np.nan

    sky = run(synthetic_grid(hole))
    assert sky.bins_deg[90] is None
    assert sky.bins_deg[270] is not None
    assert not sky.complete
    assert all(b is None or b > -10 for b in sky.bins_deg)


def test_rays_past_grid_edge_are_unknown():
    sky = horizon.skyline(TerrainStack([synthetic_grid()]), LAT, LON, 2.0, segments=[(5.0, 80_000.0, 100.0)])
    assert all(b is None for b in sky.bins_deg)


def test_contract_bins():
    sky = run(synthetic_grid())
    assert len(sky.bins_deg) == 360
    assert sky.fine_az_deg[0] == 0.0
    fine = np.zeros(1440)
    fine[1] = 5.0
    bins = horizon.to_bins(fine, np.ones(1440, bool), 0.25, 1.0)
    assert bins[0] == 5.0 and bins[1] == 0.0
    fine[:] = 0.0
    fine[3] = 5.0
    bins = horizon.to_bins(fine, np.ones(1440, bool), 0.25, 1.0)
    assert bins[0] == 0.0 and bins[1] == 5.0
    fine[:] = 0.0
    fine[-1] = 5.0
    bins = horizon.to_bins(fine, np.ones(1440, bool), 0.25, 1.0)
    assert bins[0] == 5.0 and bins[359] == 0.0
