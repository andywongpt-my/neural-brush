# MaleCNS Data Attribution

Neural Brush uses a compact derived circuit extracted from the **Janelia FlyEM Male CNS Connectome**.

## Upstream dataset

- **Dataset:** MaleCNS `male-cns:v1.0`
- **Neural Brush source ID:** `male-cns-public-bulk:v1.0`
- **Source project:** Janelia FlyEM Male CNS Connectome
- **Project page:** https://male-cns.janelia.org/
- **Download / programmatic access:** https://male-cns.janelia.org/download/
- **Upstream data license:** **Creative Commons Attribution 4.0 International (CC BY 4.0)**
- **License text/deed:** https://creativecommons.org/licenses/by/4.0/

The official MaleCNS project states that the Male CNS is licensed under CC-BY. The linked upstream license is CC BY 4.0. Neural Brush therefore treats the compact browser circuit as an adapted/subset derived asset that retains the upstream attribution/licensing obligation.

The MaleCNS project is a collaboration involving FlyEM at HHMI Janelia, the University of Cambridge Department of Zoology, the MRC Laboratory of Molecular Biology, and Google Research. Users of Neural Brush's derived data should retain upstream attribution, identify the MaleCNS source/version, link the CC BY 4.0 license, and follow any citation guidance published by the MaleCNS project.

## Canonical V1 source snapshot

Neural Brush V1 is generated from the official public bulk Feather snapshot under the MaleCNS v1.0 flat-connectome distribution. The generation workflow anonymously downloads exactly these three source files and records their SHA-256 hashes before packing:

| Source file | SHA-256 |
| --- | --- |
| `body-annotations-male-cns-v1.0-minconf-0.5.feather` | `2177e246113e4cfbf1e7772ec37c6da1955ff22e8063d0b1f833101f99a9a3b2` |
| `body-neurotransmitters-male-cns-v1.0.feather` | `95c9289220663abeb3409f3ad9e5a7f8a53f8093f5139d15502cd08da8879621` |
| `connectome-weights-male-cns-v1.0-minconf-0.5.feather` | `e35da783d1c686b2b58b3b87cd6a403ae43bfcfba8bff28e08ef752c1a56afc1` |

The complete source tables are **not** committed to this repository. The connection table alone is roughly 1 GB; it is only used by the offline generation workflow and may be cached by GitHub Actions.

The older R/`malecns` neuPrint exporter remains in `tools/malecns-export/export.R` as an optional cross-check path. It is not the canonical V1 asset-generation dependency and its private token is never required by the static app or by the public bulk generation workflow.

The `natverse/malecns` R package has its own software license independently of the MaleCNS dataset license. Its software license must not be used as a substitute for the dataset's CC BY 4.0 terms.

## Neural Brush extraction

Neural Brush does **not** distribute or load the complete MaleCNS graph in the browser. The offline exporter pins the source dataset to `male-cns:v1.0` and the circuit ID to `dna-steering-v1`.

The deterministic V1 selection is defined by [`tools/malecns-export/circuit-selection.json`](../tools/malecns-export/circuit-selection.json):

1. resolve source neuron types `DNa01` and `DNa02`,
2. select incoming partners for the first hop using source connection weight threshold `5`, capped at `64` partners,
3. select incoming partners for the second hop using threshold `10`, capped at `96` partners,
4. take the union of seeds and both partner hops,
5. retain directed internal edges between selected neurons with source weight threshold `1`,
6. preserve source body IDs, directed edge weights, type/instance metadata, recorded soma side, and neurotransmitter metadata when those fields are present upstream.

This selection, filtering, packing, role assignment, and format conversion constitute changes/adaptation relative to the upstream complete dataset. The repository documents those changes rather than implying the compact files are an unmodified full MaleCNS distribution.

Missing upstream metadata remains missing; the exporter must not invent biological values. Body IDs are serialized as decimal strings so the files remain safe across JavaScript and other tooling.

For neurotransmitter metadata, the bulk exporter prefers the upstream `consensus_nt` field and falls back to `predicted_nt` when consensus is unavailable. Neural Brush displays this as metadata and does not infer a universal excitatory/inhibitory sign from the label alone.

The source-verified DNa steering seeds in this snapshot are:

- DNa01 left: body `10442`
- DNa01 right: body `10760`
- DNa02 left: body `523769`
- DNa02 right: body `10360`

Their left/right roles come from upstream `somaSide` metadata. The source-data `forward` behavior port is intentionally empty in V1 rather than being inferred from the DNa steering seeds.

## Verified derived browser assets

The V1 browser data directory is `public/data/male-cns-v1/` and contains:

- `circuit.bin` — compact hot-path directed edge table,
- `metadata.json` — neuron identity/annotation data plus Neural Brush role flags,
- `manifest.json` — dataset/circuit/source identifiers, counts, seed selectors, UTC generation time, and SHA-256 hashes of the raw snapshot and packed binary.

The verified V1 snapshot contains:

- **151 neurons**
- **3,901 directed internal edges**
- **79,569 bytes** total across `circuit.bin`, `metadata.json`, and `manifest.json`
- raw-circuit SHA-256: `003673d40e6e274a622cb92160c06def6186f908e7a557d16ace0734395f4e9d`
- binary SHA-256: `186c3e2da2f65180523156c85170fd35acbb59eba4bc77f323d5175c1ebdc02c`

The packer enforces a combined uncompressed ceiling of **10 MiB** for the three browser files.

`inputPort`, behavior-port groupings, and simulation state are Neural Brush modeling metadata. They are not upstream MaleCNS annotations unless explicitly identified as such.

## Licensing boundary

The repository's original Neural Brush application code is licensed under the **MIT License**.

That MIT license does **not** relicense:

- MaleCNS source data,
- `public/data/male-cns-v1/circuit.bin`,
- `public/data/male-cns-v1/metadata.json`,
- `public/data/male-cns-v1/manifest.json`,
- or other MaleCNS-derived assets.

Those source/derived data assets retain the upstream **CC BY 4.0** attribution/licensing requirements. Redistribution or reuse should preserve attribution, link the license, and indicate the Neural Brush extraction/adaptation described in this document.

Third-party software used to query or transform the dataset retains its own software license independently of both the Neural Brush MIT code and the MaleCNS data license.
