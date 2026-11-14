"""Topocentric Sun and Earth directions for a lunar surface site, from NAIF SPICE.

Uses SPICE's constant-position surface observer (azlcpo) in MOON_ME with
light-time and stellar aberration (LT+S). Directions are to the body centre.
"""
from __future__ import annotations

import numpy as np
import spiceypy as spice

from .config import KERNEL_DIR, KERNELS

BODY_FRAME = 'MOON_ME'
CORRECTION = 'LT+S'


def furnish() -> None:
    spice.kclear()
    missing = [k['name'] for k in KERNELS if not (KERNEL_DIR / k['name']).exists()]
    if missing:
        raise FileNotFoundError(f'missing kernels {missing}; run python -m landerprint_science.kernels')
    for k in KERNELS:
        spice.furnsh(str(KERNEL_DIR / k['name']))


def hourly_utc(start_utc: str, stop_utc: str, step_s: float) -> list[str]:
    """UTC stamps 'YYYY-MM-DDTHH:MM:SSZ' on [start, stop)."""
    et0, et1 = spice.str2et(start_utc.rstrip('Z')), spice.str2et(stop_utc.rstrip('Z'))
    count = int(np.floor((et1 - et0) / step_s + 1e-6))
    return [spice.et2utc(et0 + i * step_s, 'ISOC', 0) + 'Z' for i in range(count)]


def site_position_km(lat_deg: float, lon_deg: float, height_above_sphere_m: float) -> np.ndarray:
    radius_km = 1737.4 + height_above_sphere_m / 1000.0
    return np.array(spice.latrec(radius_km, np.radians(lon_deg), np.radians(lat_deg)))


def az_el(target: str, utc: list[str], site_km: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Azimuth clockwise from north and elevation (deg) of the target centre."""
    az, el = np.empty(len(utc)), np.empty(len(utc))
    for i, stamp in enumerate(utc):
        et = spice.str2et(stamp.rstrip('Z'))
        state, _ = spice.azlcpo('ELLIPSOID', target, et, CORRECTION, False, True, site_km, 'MOON', BODY_FRAME)
        az[i], el[i] = np.degrees(state[1]) % 360.0, np.degrees(state[2])
    return az, el


def moon_centred(target: str, utc: list[str]) -> np.ndarray:
    """Target position from the Moon's centre in MOON_ME (km), for independent frame checks."""
    et = [spice.str2et(s.rstrip('Z')) for s in utc]
    pos, _ = spice.spkpos(target, et, BODY_FRAME, CORRECTION, 'MOON')
    return np.asarray(pos, float).reshape(-1, 3)
