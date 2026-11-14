"""Path confinement and NASA_DATA_DIR safety tests."""
from pathlib import Path

import pytest

from science.io.paths import (
    PathSecurityError,
    confined_path,
    resolve_nasa_data_dir,
    resolve_repo_data_root,
)

ROOT = Path(__file__).resolve().parents[2]


def test_confined_path_allows_child_under_root(tmp_path: Path):
    child = tmp_path / 'nested' / 'file.txt'
    child.parent.mkdir(parents=True)
    child.write_text('ok', encoding='utf-8')
    resolved = confined_path('nested/file.txt', tmp_path)
    assert resolved == child.resolve()


def test_confined_path_rejects_traversal(tmp_path: Path):
    outside = tmp_path.parent / 'outside-secret.txt'
    outside.write_text('secret', encoding='utf-8')
    with pytest.raises(PathSecurityError, match='escapes allowed root'):
        confined_path('../outside-secret.txt', tmp_path)


def test_resolve_repo_data_root_stays_in_data():
    resolved = resolve_repo_data_root('provenance/DATA_MANIFEST.json')
    assert resolved == (ROOT / 'data' / 'provenance' / 'DATA_MANIFEST.json').resolve()
    assert 'data' in resolved.parts


def test_resolve_repo_data_root_rejects_escape():
    with pytest.raises(PathSecurityError, match='escapes allowed root'):
        resolve_repo_data_root('../AGENTS.md')


def test_nasa_data_dir_requires_env(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv('NASA_DATA_DIR', raising=False)
    with pytest.raises(PathSecurityError, match='not set'):
        resolve_nasa_data_dir()


def test_nasa_data_dir_rejects_relative(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    monkeypatch.setenv('NASA_DATA_DIR', 'relative/path')
    with pytest.raises(PathSecurityError, match='absolute'):
        resolve_nasa_data_dir()


def test_nasa_data_dir_confines_relative_child(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    data_root = tmp_path / 'nasa_core'
    data_root.mkdir()
    (data_root / 'A305_GLDELEV_005.tif').write_bytes(b'fake')
    monkeypatch.setenv('NASA_DATA_DIR', str(data_root))
    resolved = resolve_nasa_data_dir(relative='A305_GLDELEV_005.tif')
    assert resolved == (data_root / 'A305_GLDELEV_005.tif').resolve()
    with pytest.raises(PathSecurityError, match='escapes allowed root'):
        resolve_nasa_data_dir(relative='../secrets.env')


def test_nasa_data_dir_rejects_forbidden_name(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    bad = tmp_path / '.env'
    bad.mkdir()
    monkeypatch.setenv('NASA_DATA_DIR', str(bad))
    with pytest.raises(PathSecurityError, match='forbidden'):
        resolve_nasa_data_dir()


def test_nasa_data_dir_rejects_forbidden_parent_component(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
):
    nested = tmp_path / '.ssh' / 'nasa_core'
    nested.mkdir(parents=True)
    monkeypatch.setenv('NASA_DATA_DIR', str(nested))
    with pytest.raises(PathSecurityError, match='forbidden path component'):
        resolve_nasa_data_dir()
