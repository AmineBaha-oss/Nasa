"""ENU and body-frame transforms for LANDERPRINT science.

Conventions (docs/MASTER_PLAN.md, docs/INTERFACES.md):
- World/local: East, North, Up (ENU).
- Azimuth: degrees clockwise from true lunar local north.
- Elevation: degrees above local horizontal.
- Longitude: east-positive (not stored here; documented for callers).
- Body: right, forward, up (RFU); yaw clockwise from north.
"""

from __future__ import annotations

import math
from typing import Sequence

Vector3 = tuple[float, float, float]


def az_el_to_enu(az_deg: float, el_deg: float) -> Vector3:
    """Convert azimuth/elevation (deg) to a unit ENU direction vector."""
    az = math.radians(az_deg)
    el = math.radians(el_deg)
    cos_el = math.cos(el)
    east = cos_el * math.sin(az)
    north = cos_el * math.cos(az)
    up = math.sin(el)
    return (east, north, up)


def enu_to_az_el(enu: Sequence[float]) -> tuple[float, float]:
    """Convert an ENU direction to azimuth/elevation (deg). Zero vector raises."""
    if len(enu) != 3:
        raise ValueError('enu must have length 3')
    east, north, up = (float(enu[0]), float(enu[1]), float(enu[2]))
    horiz = math.hypot(east, north)
    if horiz == 0.0 and up == 0.0:
        raise ValueError('cannot convert zero vector to az/el')
    az_deg = math.degrees(math.atan2(east, north)) % 360.0
    el_deg = math.degrees(math.atan2(up, horiz))
    return (az_deg, el_deg)


def body_rfu_to_enu(right: float, forward: float, up: float, yaw_deg: float) -> Vector3:
    """Rotate a body RFU vector into ENU for lander yaw (clockwise from north)."""
    yaw = math.radians(yaw_deg)
    cos_y = math.cos(yaw)
    sin_y = math.sin(yaw)
    east = right * cos_y + forward * sin_y
    north = -right * sin_y + forward * cos_y
    return (east, north, up)
