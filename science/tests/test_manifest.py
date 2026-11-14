"""Handoff integrity checks, NOT NASA raster or ephemeris validation."""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]

def test_core_manifest_has_all_five_hashes():
    manifest = json.loads((ROOT / 'data/provenance/DATA_MANIFEST.json').read_text())
    files = {f['name']: f for f in manifest['files']}
    lines = (ROOT / 'data/provenance/CORE_FILE_HASHES.sha256').read_text().splitlines()
    assert len(lines) == 5
    for line in lines:
        digest, name = line.split()
        assert files[name]['sha256'] == digest
        assert files[name]['bytes'] > 0
