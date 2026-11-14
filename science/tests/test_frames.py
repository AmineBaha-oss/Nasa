"""Unit tests for ENU / azimuth-elevation / body yaw transforms."""
import math

import pytest

from science.geometry.frames import az_el_to_enu, body_rfu_to_enu, enu_to_az_el


def test_north_horizon_is_plus_north():
    east, north, up = az_el_to_enu(0.0, 0.0)
    assert east == pytest.approx(0.0, abs=1e-12)
    assert north == pytest.approx(1.0, abs=1e-12)
    assert up == pytest.approx(0.0, abs=1e-12)


def test_east_horizon_is_plus_east():
    east, north, up = az_el_to_enu(90.0, 0.0)
    assert east == pytest.approx(1.0, abs=1e-12)
    assert north == pytest.approx(0.0, abs=1e-12)
    assert up == pytest.approx(0.0, abs=1e-12)


def test_zenith_is_plus_up():
    east, north, up = az_el_to_enu(123.0, 90.0)
    assert east == pytest.approx(0.0, abs=1e-12)
    assert north == pytest.approx(0.0, abs=1e-12)
    assert up == pytest.approx(1.0, abs=1e-12)


def test_enu_round_trip_preserves_az_el():
    for az, el in [(0.0, 10.0), (45.0, 5.0), (270.0, -2.0), (359.0, 30.0)]:
        out_az, out_el = enu_to_az_el(az_el_to_enu(az, el))
        assert out_az == pytest.approx(az, abs=1e-9)
        assert out_el == pytest.approx(el, abs=1e-9)


def test_zero_vector_rejected():
    with pytest.raises(ValueError, match='zero vector'):
        enu_to_az_el((0.0, 0.0, 0.0))


def test_body_forward_at_yaw_zero_is_north():
    east, north, up = body_rfu_to_enu(0.0, 1.0, 0.0, 0.0)
    assert east == pytest.approx(0.0, abs=1e-12)
    assert north == pytest.approx(1.0, abs=1e-12)
    assert up == pytest.approx(0.0, abs=1e-12)


def test_body_forward_at_yaw_90_is_east():
    east, north, up = body_rfu_to_enu(0.0, 1.0, 0.0, 90.0)
    assert east == pytest.approx(1.0, abs=1e-12)
    assert north == pytest.approx(0.0, abs=1e-12)
    assert up == pytest.approx(0.0, abs=1e-12)


def test_body_right_at_yaw_zero_is_east():
    east, north, up = body_rfu_to_enu(1.0, 0.0, 0.0, 0.0)
    assert east == pytest.approx(1.0, abs=1e-12)
    assert north == pytest.approx(0.0, abs=1e-12)
    assert math.isclose(up, 0.0, abs_tol=1e-12)
