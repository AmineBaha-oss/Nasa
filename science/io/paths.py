"""Path confinement for NASA_DATA_DIR and repo data roots.

Fail closed: never silently fall back to fabricated rasters or escape allowed roots.
Credentials and private downloads must stay outside Git; this module only resolves paths.
"""

from __future__ import annotations

import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_REPO_DATA = REPO_ROOT / 'data'
FORBIDDEN_PATH_PARTS = frozenset({'.git', '.env', 'credentials.json', '.aws', '.ssh'})


class PathSecurityError(ValueError):
    """Raised when a path escapes an allowed root or required env is missing."""


def _is_relative_to(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


def _assert_no_forbidden_parts(path: Path, label: str) -> None:
    for part in path.parts:
        cleaned = part.rstrip('\\/')
        if cleaned in FORBIDDEN_PATH_PARTS:
            raise PathSecurityError(f'{label} contains forbidden path component: {cleaned}')


def confined_path(path: Path | str, allowed_root: Path) -> Path:
    """Resolve *path* and require it to stay under *allowed_root*."""
    root = allowed_root.resolve()
    candidate = Path(path)
    if not candidate.is_absolute():
        candidate = root / candidate
    resolved = candidate.resolve()
    if not _is_relative_to(resolved, root):
        raise PathSecurityError(f'path escapes allowed root: {resolved} not under {root}')
    return resolved


def resolve_repo_data_root(subpath: Path | str | None = None) -> Path:
    """Resolve a path under the repository ``data/`` directory only."""
    root = DEFAULT_REPO_DATA.resolve()
    if not root.is_dir():
        raise PathSecurityError(f'repository data root missing: {root}')
    if subpath is None:
        return root
    return confined_path(subpath, root)


def resolve_nasa_data_dir(
    env_var: str = 'NASA_DATA_DIR',
    *,
    relative: Path | str | None = None,
) -> Path:
    """Resolve NASA_DATA_DIR from the environment and optionally a relative child.

    The env value must be an absolute existing directory. Relative children are
    confined under that directory (blocks ``..`` traversal).
    """
    raw = os.environ.get(env_var)
    if raw is None or not str(raw).strip():
        raise PathSecurityError(f'{env_var} is not set; refuse to invent a data directory')
    root = Path(raw).expanduser()
    if not root.is_absolute():
        raise PathSecurityError(f'{env_var} must be an absolute path, got {raw!r}')
    resolved_root = root.resolve()
    if not resolved_root.is_dir():
        raise PathSecurityError(f'{env_var} is not an existing directory: {resolved_root}')
    _assert_no_forbidden_parts(resolved_root, env_var)
    if relative is None:
        return resolved_root
    return confined_path(relative, resolved_root)
