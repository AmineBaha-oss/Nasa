import numpy as np
import pytest

from landerprint_science import frame
from landerprint_science.config import A305_DEM, SITES


def test_stereo_round_trip():
    lat = np.array([-89.9, -89.147356, -85.0, -80.0, -70.0])
    lon = np.array([0.0, -104.714801, 45.0, 179.0, -60.0])
    x, y = frame.to_map(lat, lon)
    lat2, lon2 = frame.from_map(x, y)
    assert np.allclose(lat2, lat, atol=1e-9)
    assert np.allclose((lon2 - lon + 180) % 360 - 180, 0, atol=1e-9)


def test_true_scale_at_pole():
    x, y = frame.to_map(-90.0 + np.degrees(100.0 / frame.R_MOON_M), 30.0)
    assert np.hypot(x, y) == pytest.approx(100.0, abs=1e-3)


def test_north_and_east_convention():
    lat, lon = -89.2, -100.0
    axes = frame.enu_axes(lat, lon)
    p0 = frame.body_vector(lat, lon, frame.R_MOON_M)
    for az in (0.0, 90.0, 180.0, 270.0):
        lat2, lon2 = frame.travel(lat, lon, az, 50.0)
        got, el = frame.az_el(frame.body_vector(lat2, lon2, frame.R_MOON_M) - p0, axes)
        assert (got - az + 180) % 360 - 180 == pytest.approx(0.0, abs=1e-3)
        assert el == pytest.approx(0.0, abs=0.01)
    assert frame.travel(lat, lon, 0.0, 1000.0)[0] > lat
    assert frame.az_el(axes[0], axes)[0] == pytest.approx(90.0)
    assert frame.az_el(axes[2], axes)[1] == pytest.approx(90.0)


def test_pole_rejected():
    with pytest.raises(ValueError):
        frame.enu_axes(-90.0, 0.0)


def test_projection_matches_a305():
    rasterio = pytest.importorskip('rasterio')
    if not A305_DEM.exists():
        pytest.skip('A305 DEM not present')
    from landerprint_science.terrain import check_projection
    with rasterio.open(A305_DEM) as src:
        check_projection(src.crs)
        for site in SITES:
            x, y = frame.to_map(site['latitudeDeg'], site['longitudeEastDeg'])
            row, col = src.index(float(x), float(y))
            assert 0 <= row < src.height and 0 <= col < src.width
            cx, cy = src.xy(row, col)
            lat, lon = frame.from_map(cx, cy)
            assert abs(lat - site['latitudeDeg']) < 1e-4
            assert np.isfinite(src.read(1, window=((row, row + 1), (col, col + 1)))[0, 0])
