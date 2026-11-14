"""Download NAIF kernels and LOLA DEMs into data/raw and pin their SHA256.

The first download records URL, size and SHA256 in data/provenance/SCIENCE_INPUTS.json.
Later runs re-hash local files and stop if any differ from the record.

Usage: python -m landerprint_science.kernels
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import shutil
import sys
import urllib.request
from pathlib import Path

from .config import INPUTS_LOCK, KERNEL_DIR, KERNELS, LOLA, LOLA_DIR, USER_AGENT


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda: f.read(1 << 20), b''):
            h.update(block)
    return h.hexdigest()


def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    part = dest.with_name(dest.name + '.part')
    req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
    with urllib.request.urlopen(req, timeout=120) as r, part.open('wb') as f:
        if 'text/html' in r.headers.get('Content-Type', ''):
            raise RuntimeError(f'{url} returned HTML, not data')
        expected = int(r.headers.get('Content-Length') or -1)
        shutil.copyfileobj(r, f, 1 << 20)
    if expected >= 0 and part.stat().st_size != expected:
        raise RuntimeError(f'{url}: got {part.stat().st_size} bytes, server announced {expected}; rerun to retry')
    part.replace(dest)


def entries():
    return [(k, KERNEL_DIR / k['name']) for k in KERNELS] + [(k, LOLA_DIR / k['name']) for k in LOLA]


def load_lock() -> dict:
    return json.loads(INPUTS_LOCK.read_text()) if INPUTS_LOCK.exists() else {}


def main() -> int:
    lock = load_lock()
    for entry, path in entries():
        if not path.exists():
            print(f'downloading {entry["url"]}')
            download(entry['url'], path)
        digest = sha256(path)
        known = lock.get(entry['id'])
        if known and known['sha256'] != digest:
            print(f'{entry["id"]}: SHA256 changed from the record; stop and investigate', file=sys.stderr)
            return 1
        if not known:
            lock[entry['id']] = {
                'filename': entry['name'], 'url': entry['url'], 'bytes': path.stat().st_size,
                'sha256': digest, 'retrievedUtc': dt.datetime.now(dt.UTC).strftime('%Y-%m-%dT%H:%M:%SZ'),
            }
        print(f'{entry["id"]}: {digest}')
    INPUTS_LOCK.write_text(json.dumps(lock, indent=2) + '\n')
    return 0


if __name__ == '__main__':
    sys.exit(main())
