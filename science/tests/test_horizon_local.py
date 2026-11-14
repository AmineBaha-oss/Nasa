"""Local DEM horizon smoke test."""
from pathlib import Path

import pytest

from science.sites.candidates import CANDIDATE_SITES
from science.terrain.horizon import compute_local_horizon

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_A305 = ROOT / 'data' / 'nasa_a305' / 'A3CLR22_5_Connecting_Ridge_Extension'


@pytest.fixture
def a305_dir(monkeypatch: pytest.MonkeyPatch):
    if not DEFAULT_A305.is_dir():
        pytest.skip('A305 subset not present locally')
    monkeypatch.setenv('NASA_DATA_DIR', str(DEFAULT_A305.resolve()))
    return DEFAULT_A305


def test_local_horizon_profile_shape(a305_dir: Path):
    site = CANDIDATE_SITES[0]
    profile = compute_local_horizon(
        site.longitude_east_deg,
        site.latitude_deg,
        observer_height_m=2.0,
        azimuth_step_deg=90.0,
        extent_km=1.0,
        step_m=50.0,
    )
    assert profile['horizonCoverage'] == 'local-only'
    assert profile['sourceId'] == 'a305-dem-local'
    assert len(profile['anglesDeg']) == 4
    assert all(isinstance(v, float) for v in profile['anglesDeg'])


def test_zero_step_rejected_before_sampling(a305_dir: Path):
    site = CANDIDATE_SITES[0]
    with pytest.raises(ValueError, match='step_m'):
        compute_local_horizon(
            site.longitude_east_deg,
            site.latitude_deg,
            observer_height_m=2.0,
            step_m=0.0,
        )
