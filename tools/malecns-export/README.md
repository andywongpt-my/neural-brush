# MaleCNS exporter

This directory contains the offline data-selection pipeline for the Neural Brush V1 connectome circuit.

The browser application does **not** query neuPrint at runtime. V1 assets are generated offline from the official public MaleCNS `male-cns:v1.0` bulk Feather snapshot, then packed into a bounded browser bundle.

## Canonical V1 path: public bulk snapshot

The canonical exporter is:

```text
tools/malecns-export/export_bulk.py
```

It does **not** require a neuPrint token.

Requirements for a manual local regeneration:

- Python 3.12+
- `pyarrow`
- the three official MaleCNS v1.0 Feather files listed in [`docs/data-attribution.md`](../../docs/data-attribution.md)

Install the Python dependency:

```bash
python -m pip install pyarrow==25.0.1
```

Place the source files under:

```text
tools/malecns-export/cache/
```

with these names:

```text
body-annotations-male-cns-v1.0-minconf-0.5.feather
body-neurotransmitters-male-cns-v1.0.feather
connectome-weights-male-cns-v1.0-minconf-0.5.feather
```

Then run:

```bash
python tools/malecns-export/export_bulk.py
npm run data:pack
```

The exporter writes:

```text
tools/malecns-export/out/raw-circuit.json
```

and the packer writes:

```text
public/data/male-cns-v1/circuit.bin
public/data/male-cns-v1/metadata.json
public/data/male-cns-v1/manifest.json
```

`cache/` and `out/` are intentionally ignored. The large upstream source tables are never committed to the repository.

The GitHub workflow `.github/workflows/generate-malecns-assets.yml` reproduces this process from the official public snapshot, records source SHA-256 hashes, validates the 10 MiB payload ceiling, and commits only the verified compact runtime files.

## Selection method

V1 pins the source dataset to `male-cns:v1.0` and starts from the DNa01 and DNa02 seed types. It takes two deterministic bounded incoming-partner hops and then retains the directed edge closure inside the selected neuron set.

The bulk exporter preserves source body IDs, types, instances, source `somaSide`, neurotransmitter metadata, directed edge endpoints, and source connection weights where those source fields are available. Missing source fields remain `null`; the exporter does not invent biological metadata.

For neurotransmitter metadata, `consensus_nt` is preferred and `predicted_nt` is used only when consensus is unavailable.

Frontier `inputPort` flags are a Neural Brush graph boundary. They do not mean that every marked neuron is a retinal or visual neuron. Local photo features are connected later through a synthetic sensory adapter documented separately from the source connectome.

Behavior ports are also a modeling boundary. Left/right ports are accepted only when the DNa01/DNa02 seed metadata contains source `somaSide` values `L` and `R`; the exporter stops instead of guessing. The V1 source-data `forward` port is intentionally empty because this DNa steering circuit is not treated as a verified forward-speed command.

## Optional neuPrint cross-check path

`export.R` remains available as a secondary R/`malecns` query path for scientific cross-checking. That path uses a private `neuprint_token`, but it is **not** required to build the canonical V1 browser assets.

If you use it, install the R dependencies:

```bash
R -q -e 'install.packages("natmanager"); natmanager::install(pkgs="natverse/malecns")'
R -q -e 'install.packages("jsonlite")'
```

Set the token only in a private `.Renviron` or process environment. Do **not** commit a token, `.Renviron`, shell history containing a token, or any other credential. `export.R` never logs the token.

## Output invariants

A successful canonical export must satisfy all of these before packing:

- `dataset` is exactly `male-cns:v1.0`.
- Every edge endpoint exists in `neurons`.
- Every edge weight is a positive integer.
- Both left and right DNa turn seed groups are non-empty and come from source `somaSide` metadata.
- `forward` remains empty unless separate biological evidence is explicitly incorporated in a future circuit revision.
- Body IDs are serialized as decimal strings.
- No credential is required or emitted by the bulk exporter.

The full MaleCNS graph is not distributed with Neural Brush. The packed browser payload has a 10 MiB V1 ceiling; the current verified circuit is about 78 KiB.
