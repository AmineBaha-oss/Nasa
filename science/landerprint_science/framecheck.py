"""Check that A305 and LOLA 80 m share the MOON_ME frame and height reference.

A305 is averaged over each LOLA pixel footprint and compared with LOLA at
the same map point. A frame or datum mismatch shows up as a large median
offset, or as a lower spread when one grid is shifted horizontally.

Usage: python -m landerprint_science.framecheck
"""
from __future__ import annotations

import json
import sys

import numpy as np

from .config import A305_DEM, LOLA, LOLA_DIR, PROVENANCE
from .terrain import Grid

MAX_MEDIAN_OFFSET_M = 10.0
SHIFTS_M = (-160.0, -80.0, 0.0, 80.0, 160.0)
RESULT = PROVENANCE / 'A305_FRAME_CHECK.json'


def footprint_mean(grid: Grid, x, y, half_m: float) -> np.ndarray:
    offsets = np.arange(-half_m + grid.pixel_m / 2, half_m, grid.pixel_m)
    dx, dy = np.meshgrid(offsets, offsets)
    h = grid.heights(x[:, None] + dx.ravel(), y[:, None] + dy.ravel())
    return np.where(np.isnan(h).any(axis=1), np.nan, np.nanmean(h, axis=1))


def run(points: int = 1000, seed: int = 0) -> dict:
    a305 = Grid.read(A305_DEM, 'a305-elev')
    rows, cols = a305.values.shape
    left, top = a305.transform.c, a305.transform.f
    right, bottom = left + cols * a305.transform.a, top + rows * a305.transform.e
    lola_entry = LOLA[0]
    lola = Grid.read(LOLA_DIR / lola_entry['name'], lola_entry['id'], bounds=(left - 500, bottom - 500, right + 500, top + 500))
    half = lola.pixel_m / 2
    rng = np.random.default_rng(seed)
    x = rng.uniform(left + half + 200, right - half - 200, points * 3)
    y = rng.uniform(bottom + half + 200, top - half - 200, points * 3)
    ref = footprint_mean(a305, x, y, half)
    keep = ~np.isnan(ref)
    x, y, ref = x[keep][:points], y[keep][:points], ref[keep][:points]
    shifts = []
    for sx in SHIFTS_M:
        for sy in SHIFTS_M:
            d = lola.heights(x + sx, y + sy) - ref
            d = d[~np.isnan(d)]
            shifts.append({'dxM': sx, 'dyM': sy, 'n': int(d.size), 'medianM': float(np.median(d)),
                           'stdM': float(np.std(d))})
    zero = next(s for s in shifts if s['dxM'] == 0 and s['dyM'] == 0)
    best = min(shifts, key=lambda s: s['stdM'])
    passed = abs(zero['medianM']) <= MAX_MEDIAN_OFFSET_M and best['dxM'] == 0 and best['dyM'] == 0
    d = lola.heights(x, y) - ref
    d = d[~np.isnan(d)]
    return {
        'description': 'LOLA 80 m minus A305 5 m averaged over each 80 m footprint, at random points in the A305 tile',
        'a305': A305_DEM.name, 'lola': lola_entry['name'], 'points': int(d.size),
        'meanOffsetM': float(d.mean()), 'medianOffsetM': float(np.median(d)), 'stdM': float(d.std()),
        'p05M': float(np.percentile(d, 5)), 'p95M': float(np.percentile(d, 95)),
        'criteria': f'|median| <= {MAX_MEDIAN_OFFSET_M} m and the smallest spread is at zero horizontal shift',
        'bestShift': best, 'shifts': shifts, 'passed': bool(passed),
    }


def main() -> int:
    result = run()
    RESULT.write_text(json.dumps(result, indent=2) + '\n')
    print(f"{result['points']} points: median {result['medianOffsetM']:.2f} m, mean {result['meanOffsetM']:.2f} m, "
          f"std {result['stdM']:.2f} m, best shift ({result['bestShift']['dxM']}, {result['bestShift']['dyM']}) m, "
          f"passed={result['passed']}")
    return 0 if result['passed'] else 1


if __name__ == '__main__':
    sys.exit(main())
