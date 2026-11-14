"""Candidate sites must fall inside the A305 DEM when NASA_DATA_DIR is set."""
from pathlib import Path

import pytest

from science.coords.lunar import lonlat_to_stereographic, stereographic_to_lonlat
from science.sites.candidates import CANDIDATE_SITES, DATE_WINDOWS
from science.terrain.dem import sample_dem_elevation

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_A305 = ROOT / 'data' / 'nasa_a305' / 'A3CLR22_5_Connecting_Ridge_Extension'


@pytest.fixture
def a305_dir(monkeypatch: pytest.MonkeyPatch):
    if not DEFAULT_A305.is_dir():
        pytest.skip('A305 subset not present locally')
    monkeypatch.setenv('NASA_DATA_DIR', str(DEFAULT_A305.resolve()))
    return DEFAULT_A305


def test_two_sites_and_two_windows_defined():
    assert len(CANDIDATE_SITES) == 2
    assert len(DATE_WINDOWS) == 2
    assert all(w.start_utc.endswith('Z') and w.stop_utc.endswith('Z') for w in DATE_WINDOWS)


def test_stereo_round_trip():
    lon, lat = -102.713980, -89.111829
    easting, northing = lonlat_to_stereographic(lon, lat)
    lon2, lat2 = stereographic_to_lonlat(easting, northing)
    assert lon2 == pytest.approx(lon, abs=1e-6)
    assert lat2 == pytest.approx(lat, abs=1e-6)


def test_candidates_inside_dem(a305_dir: Path):
    for site in CANDIDATE_SITES:
        sample = sample_dem_elevation(site.longitude_east_deg, site.latitude_deg)
        assert sample.inside_raster, site.id
        assert sample.elevation_m is not None, site.id
