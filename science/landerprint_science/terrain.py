"""Terrain grids in south polar stereographic metres, sampled by map coordinate."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import rasterio
from affine import Affine
from rasterio.windows import Window, from_bounds

from .frame import R_MOON_M


def check_projection(crs) -> None:
    p = crs.to_dict() if crs else {}
    scale_ok = p.get('k', 1) == 1 and p.get('lat_ts', -90) == -90
    if not (p.get('proj') == 'stere' and p.get('lat_0') == -90 and p.get('lon_0', 0) == 0
            and p.get('R') == R_MOON_M and scale_ok and p.get('x_0', 0) == 0 and p.get('y_0', 0) == 0):
        raise ValueError(f'not the lunar south polar stereographic sphere: {crs}')


@dataclass
class Grid:
    """Heights (m above the 1737.4 km sphere) on a north-up grid; NaN is unknown."""

    values: np.ndarray
    transform: Affine
    name: str

    @classmethod
    def read(cls, path: Path, name: str, bounds: tuple[float, float, float, float] | None = None) -> 'Grid':
        with rasterio.open(path) as src:
            check_projection(src.crs)
            if src.transform.b or src.transform.d:
                raise ValueError(f'{path.name} is rotated')
            window = None
            if bounds is not None:
                window = from_bounds(*bounds, transform=src.transform).round_offsets().round_lengths()
                window = window.intersection(Window(0, 0, src.width, src.height))
            data = src.read(1, window=window, masked=True)
            transform = src.window_transform(window) if window is not None else src.transform
        values = np.asarray(data.astype(np.float32).filled(np.nan))
        values[~np.isfinite(values) | (np.abs(values) > 1e5)] = np.nan
        return cls(values, transform, name)

    @property
    def pixel_m(self) -> float:
        return abs(self.transform.a)

    def heights(self, x, y) -> np.ndarray:
        """Bilinear height between the four surrounding pixel centres; NaN outside or next to a gap."""
        x, y = np.asarray(x, float), np.asarray(y, float)
        col, row = ~self.transform @ (x, y)
        col, row = np.asarray(col) - 0.5, np.asarray(row) - 0.5
        c0, r0 = np.floor(col).astype(np.int64), np.floor(row).astype(np.int64)
        rows, cols = self.values.shape
        inside = (c0 >= 0) & (r0 >= 0) & (c0 + 1 < cols) & (r0 + 1 < rows)
        c0, r0 = np.where(inside, c0, 0), np.where(inside, r0, 0)
        fc, fr = col - c0, row - r0
        v = self.values
        top = v[r0, c0] * (1 - fc) + v[r0, c0 + 1] * fc
        bottom = v[r0 + 1, c0] * (1 - fc) + v[r0 + 1, c0 + 1] * fc
        return np.where(inside, top * (1 - fr) + bottom * fr, np.nan)


class TerrainStack:
    """Grids ordered finest first; each point takes the first grid with a value."""

    def __init__(self, grids: list[Grid]):
        self.grids = grids

    def heights(self, x, y) -> np.ndarray:
        x, y = np.asarray(x, float), np.asarray(y, float)
        out = np.full(x.shape, np.nan)
        for grid in self.grids:
            todo = np.isnan(out)
            if not todo.any():
                break
            out[todo] = grid.heights(x[todo], y[todo])
        return out
