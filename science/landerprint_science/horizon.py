"""Terrain skyline seen from an observer above the surface.

Rays leave the site along great circles at a fine azimuth spacing. At every
range sample the terrain point and the observer are placed as body-frame
vectors on the lunar sphere, so curvature is exact; the skyline is the largest
elevation of any terrain point along the ray. A ray with any sample that no
grid covers is incomplete, and every output bin touching it is unknown.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from . import frame
from .config import AZIMUTH_STEP_DEG, FINE_AZIMUTH_STEP_DEG, SEGMENTS
from .terrain import TerrainStack


@dataclass
class Skyline:
    observer_height_m: float
    ground_height_m: float
    fine_az_deg: np.ndarray
    fine_elev_deg: np.ndarray      # NaN where the ray is incomplete
    limiting_range_m: np.ndarray
    fine_complete: np.ndarray
    bins_deg: list                 # contract grid: bin i centred on i * step; None = unknown
    extent_km: float

    @property
    def complete(self) -> bool:
        return all(b is not None for b in self.bins_deg)


def ranges(segments=SEGMENTS) -> np.ndarray:
    return np.concatenate([np.arange(a, b, step) for a, b, step in segments])


def to_bins(fine_elev: np.ndarray, fine_ok: np.ndarray, fine_step: float, step: float) -> list:
    per_bin = int(round(step / fine_step))
    reach = per_bin // 2
    n = len(fine_elev)
    out = []
    for i in range(int(round(360.0 / step))):
        members = np.arange(i * per_bin - reach, i * per_bin + reach + 1) % n
        out.append(round(float(fine_elev[members].max()), 4) if fine_ok[members].all() else None)
    return out


def skyline(stack: TerrainStack, lat_deg: float, lon_deg: float, observer_height_m: float,
            segments=SEGMENTS, fine_step: float = FINE_AZIMUTH_STEP_DEG,
            step: float = AZIMUTH_STEP_DEG, chunk: int = 90) -> Skyline:
    x0, y0 = frame.to_map(lat_deg, lon_deg)
    ground = float(stack.heights(np.array([x0]), np.array([y0]))[0])
    if np.isnan(ground):
        raise ValueError('no terrain under the site')
    up = frame.enu_axes(lat_deg, lon_deg)[2]
    eye = up * (frame.R_MOON_M + ground + observer_height_m)

    az = np.arange(int(round(360.0 / fine_step))) * fine_step
    s = ranges(segments)
    elev = np.empty(len(az))
    limit = np.empty(len(az))
    ok = np.empty(len(az), dtype=bool)
    for i in range(0, len(az), chunk):
        a = az[i:i + chunk, None]
        lat, lon = frame.travel(lat_deg, lon_deg, a, s[None, :])
        x, y = frame.to_map(lat, lon)
        h = stack.heights(x, y)
        pts = frame.body_vector(lat, lon, frame.R_MOON_M + h)
        sight = pts - eye
        angle = np.degrees(np.arcsin(np.clip((sight @ up) / np.linalg.norm(sight, axis=-1), -1.0, 1.0)))
        angle = np.where(np.isnan(angle), -np.inf, angle)
        k = np.argmax(angle, axis=1)
        elev[i:i + chunk] = angle[np.arange(len(k)), k]
        limit[i:i + chunk] = s[k]
        ok[i:i + chunk] = ~np.isnan(h).any(axis=1)
    elev = np.where(ok, elev, np.nan)
    return Skyline(observer_height_m, ground, az, elev, limit, ok,
                   to_bins(elev, ok, fine_step, step), float(segments[-1][1]) / 1000.0)
