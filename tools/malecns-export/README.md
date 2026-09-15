# MaleCNS exporter

This directory contains the offline data-selection pipeline for the Neural Brush V1 connectome circuit.

The browser application does **not** query neuPrint and does not need R at runtime. This exporter is run offline to create a bounded, auditable raw snapshot from the public MaleCNS `male-cns:v1.0` dataset. A later packing step converts that raw snapshot into compact browser assets.

## Requirements

Install the R dependencies:

```bash
R -q -e 'install.packages("natmanager"); natmanager::install(pkgs="natverse/malecns")'
R -q -e 'install.packages("jsonlite")'
```

`malecns` installs/uses its normal dependencies, including `dplyr` and `neuprintr`.

## neuPrint token

A neuPrint token is required for the exporter. Obtain a token from neuPrint and expose it through the `neuprint_token` environment variable, for example in your local `.Renviron` or only for the current process.

Do **not** commit a neuPrint token, `.Renviron`, shell history containing a token, or any other credential. `export.R` never logs the token.

Example `.Renviron` entry on a private workstation:

```text
neuprint_token=YOUR_TOKEN_HERE
```

## Run

From the repository root:

```bash
Rscript tools/malecns-export/export.R
```

The exporter reads `tools/malecns-export/circuit-selection.json` and writes:

```text
tools/malecns-export/out/raw-circuit.json
```

The `out/` directory is intentionally ignored. The raw file should be regenerated from the pinned selection configuration and inspected before the browser assets are packed.

## Selection method

V1 pins the source dataset to `male-cns:v1.0` and starts from the DNa01 and DNa02 seed types. It takes two deterministic bounded incoming-partner hops and then retains the directed edge closure inside the selected neuron set.

The exporter preserves source body IDs, types, instances, source `somaSide`, neurotransmitter predictions (`predictedNt`), directed edge endpoints, and source connection weights where those source fields are available. Missing source fields remain `null`; the exporter does not invent biological metadata.

Frontier `inputPort` flags are a Neural Brush graph boundary. They do not mean that every marked neuron is a retinal or visual neuron. Local photo features are connected later through a synthetic sensory adapter documented separately from the source connectome.

Behavior ports are also a modeling boundary. Left/right ports are accepted only when the DNa01/DNa02 seed metadata contains source `somaSide` values `L` and `R`; the exporter stops instead of guessing. The `forward` port is the aggregate set of verified DNa seed IDs for the V1 modeling readout.

## Output invariants

A successful export must satisfy all of these before packing:

- `dataset` is exactly `male-cns:v1.0`.
- Every edge endpoint exists in `neurons`.
- Every edge weight is a positive integer.
- Both left and right DNa turn seed groups are non-empty and come from source `somaSide` metadata.
- Body IDs are serialized as decimal strings.
- No credential appears in the raw output.

The full MaleCNS graph is not distributed with Neural Brush. The later packed browser payload has a 10 MiB V1 ceiling.
