import numpy as np
import pytest

from landerprint_science import ephemeris, frame, horizons_ref
from landerprint_science.config import KERNEL_DIR, KERNELS, SITES, WINDOWS

spice = pytest.importorskip('spiceypy')

pytestmark = pytest.mark.skipif(not all((KERNEL_DIR / k['name']).exists() for k in KERNELS),
                                reason='SPICE kernels missing; run python -m landerprint_science.kernels')


@pytest.fixture(scope='module', autouse=True)
def kernels():
    ephemeris.furnish()
    yield
    spice.kclear()


def test_utc_strings_end_in_z():
    utc = ephemeris.hourly_utc(WINDOWS[0]['startUtc'], WINDOWS[0]['stopUtc'], 3600.0)
    assert len(utc) == 168
    assert utc[0] == WINDOWS[0]['startUtc']
    assert all(u.endswith('Z') and len(u) == 20 for u in utc)


@pytest.mark.parametrize('site', SITES, ids=[s['id'] for s in SITES])
@pytest.mark.parametrize('window', WINDOWS, ids=[w['id'] for w in WINDOWS])
@pytest.mark.parametrize('target', ['sun', 'earth'])
def test_spice_matches_horizons(site, window, target):
    path = horizons_ref.reference_path(site['id'], window['id'], target)
    if not path.exists():
        pytest.skip(f'{path.name} missing; run python -m landerprint_science.horizons_ref')
    rows = horizons_ref.parse(path.read_text(encoding='utf-8'))
    height = horizons_ref.TARGETS[target][1]
    site_km = ephemeris.site_position_km(site['latitudeDeg'], site['longitudeEastDeg'],
                                         horizons_ref.ground_height_m(site) + height)
    az, el = ephemeris.az_el(target.upper(), [r[0] for r in rows], site_km)
    ref_az, ref_el = np.array([r[1] for r in rows]), np.array([r[2] for r in rows])
    d_az = np.abs((az - ref_az + 180) % 360 - 180) * np.cos(np.radians(ref_el))
    assert np.max(np.abs(el - ref_el)) < 0.01
    assert np.max(d_az) < 0.01


@pytest.mark.parametrize('target', ['SUN', 'EARTH'])
def test_moon_centred_shortcut_matches_azlcpo(target):
    site = SITES[0]
    lat, lon = site['latitudeDeg'], site['longitudeEastDeg']
    site_km = ephemeris.site_position_km(lat, lon, 1100.0)
    axes = frame.enu_axes(lat, lon)
    utc = ephemeris.hourly_utc(WINDOWS[0]['startUtc'], WINDOWS[0]['stopUtc'], 6 * 3600.0)
    for stamp in utc:
        et = spice.str2et(stamp.rstrip('Z'))
        state, _ = spice.azlcpo('ELLIPSOID', target, et, 'NONE', False, True, site_km, 'MOON', 'MOON_ME')
        pos, _ = spice.spkpos(target, et, 'MOON_ME', 'NONE', 'MOON')
        az, el = frame.az_el(np.asarray(pos) - site_km, axes)
        assert abs((az - np.degrees(state[1]) + 180) % 360 - 180) * np.cos(np.radians(el)) < 1e-3
        assert abs(el - np.degrees(state[2])) < 1e-3
