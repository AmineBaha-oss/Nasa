# LANDERPRINT

A lunar site, date and spacecraft-heading explorer. The app currently shows a setup screen; science data and hardware models are still pending.

## Run

Requires Node 24 and Python 3.11+.

```sh
cd web
npm ci
npm run dev
```

## Test

```sh
cd web
npm test
npm run build
```

From the repository root:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r science/requirements.txt
.venv/bin/python -m pytest
```

## Data

Follow [the download instructions](docs/DATA_DELIVERY_INSTRUCTIONS.md) to get the Connecting Ridge Extension dataset from Zenodo. Set `NASA_DATA_DIR` to your extracted data directory. Raw rasters and downloads stay out of Git.

## Project structure

| Folder | Contents |
|---|---|
| `web/` | React app, shared types and web tests |
| `science/` | Python dependencies and data checks |
| `tests/fixtures/` | Synthetic unit-test inputs |
| `data/provenance/` | Expected file metadata and checksums |
| `docs/` | Plan, data setup, sources and open tasks |
| `prompts/` | Agent assignments |
| `skills_templates/` | Project skills |
| `mcp_examples/` | MCP configuration examples |

See [the task board](docs/TASK_BOARD.md) and [open inputs](docs/INPUT_REQUESTS.md) for remaining work. MCP examples need configuration before use.
