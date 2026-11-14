"""Lunar sphere geometry: body-fixed vectors, local ENU axes, great-circle travel.

Body frame is MOON_ME on the 1737.4 km reference sphere; latitude is
planetocentric and longitude east-positive. Local north points along the
meridian toward the north pole, so azimuth is clockwise from north.
"""
from __future__ import annotations

import numpy as np
from pyproj import CRS, Transformer

R_MOON_M = 1_737_400.0
MOON_GEOGRAPHIC = CRS.from_proj4('+proj=longlat +R=1737400 +no_defs')
SOUTH_POLAR_STEREO = CRS.from_proj4('+proj=stere +lat_0=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R=1737400 +units=m +no_defs')
_TO_MAP = Transformer.from_crs(MOON_GEOGRAPHIC, SOUTH_POLAR_STEREO, always_xy=True)
_TO_GEO = Transformer.from_crs(SOUTH_POLAR_STEREO, MOON_GEOGRAPHIC, always_xy=True)


def to_map(lat_deg, lon_deg):
    """South polar stereographic easting, northing (m)."""
    return _TO_MAP.transform(np.asarray(lon_deg, float), np.asarray(lat_deg, float))


def from_map(x_m, y_m):
    """Latitude, east longitude (deg) from stereographic metres."""
    lon, lat = _TO_GEO.transform(np.asarray(x_m, float), np.asarray(y_m, float))
    return lat, lon


def body_vector(lat_deg, lon_deg, radius):
    phi, lam = np.radians(lat_deg), np.radians(lon_deg)
    return np.stack([radius * np.cos(phi) * np.cos(lam),
                     radius * np.cos(phi) * np.sin(lam),
                     radius * np.sin(phi) * np.ones_like(lam)], axis=-1)


def enu_axes(lat_deg: float, lon_deg: float) -> np.ndarray:
    """Rows are the east, north and up unit vectors in the body frame."""
    if abs(lat_deg) >= 90.0:
        raise ValueError('azimuth is undefined at the pole')
    phi, lam = np.radians(lat_deg), np.radians(lon_deg)
    sp, cp, sl, cl = np.sin(phi), np.cos(phi), np.sin(lam), np.cos(lam)
    return np.array([[-sl, cl, 0.0],
                     [-sp * cl, -sp * sl, cp],
                     [cp * cl, cp * sl, sp]])


def az_el(vectors, axes: np.ndarray):
    """Azimuth clockwise from north and elevation (deg) of body-frame direction vectors."""
    local = np.asarray(vectors, float) @ axes.T
    east, north, up = local[..., 0], local[..., 1], local[..., 2]
    az = np.degrees(np.arctan2(east, north)) % 360.0
    el = np.degrees(np.arctan2(up, np.hypot(east, north)))
    return az, el


def travel(lat_deg: float, lon_deg: float, az_deg, dist_m):
    """Point reached by moving dist_m along a great circle at initial azimuth az_deg."""
    phi1, lam1 = np.radians(lat_deg), np.radians(lon_deg)
    a = np.radians(np.asarray(az_deg, float))
    d = np.asarray(dist_m, float) / R_MOON_M
    sin_phi2 = np.sin(phi1) * np.cos(d) + np.cos(phi1) * np.sin(d) * np.cos(a)
    phi2 = np.arcsin(np.clip(sin_phi2, -1.0, 1.0))
    lam2 = lam1 + np.arctan2(np.sin(a) * np.sin(d) * np.cos(phi1), np.cos(d) - np.sin(phi1) * sin_phi2)
    return np.degrees(phi2), (np.degrees(lam2) + 180.0) % 360.0 - 180.0
