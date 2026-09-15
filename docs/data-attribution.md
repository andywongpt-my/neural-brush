# MaleCNS Data Attribution

Neural Brush uses a compact derived circuit extracted from the **Janelia FlyEM Male CNS Connectome**.

## Upstream dataset

- **Dataset:** MaleCNS `male-cns:v1.0`
- **Source project:** Janelia FlyEM Male CNS Connectome
- **Project page:** https://male-cns.janelia.org/
- **Download / programmatic access:** https://male-cns.janelia.org/download/
- **Upstream data license:** **CC-BY**, as stated by the Janelia Male CNS project

The MaleCNS project is a collaboration involving Janelia FlyEM, the University of Cambridge, the MRC Laboratory of Molecular Biology, and Google Research. Users of Neural Brush's derived data should retain the upstream attribution and follow any citation guidance published by the MaleCNS project.

## Neural Brush extraction

Neural Brush does **not** distribute or load the complete MaleCNS graph in the browser. The offline exporter pins the source dataset to `male-cns:v1.0` and the circuit ID to `dna-steering-v1`.

The deterministic V1 selection is defined by [`tools/malecns-export/circuit-selection.json`](../tools/malecns-export/circuit-selection.json):

1. resolve source neuron types `DNa01` and `DNa02`,
2. select incoming partners for the first hop using source connection weight threshold `5`, capped at `64` partners,
3. select incoming partners for the second hop using threshold `10`, capped at `96` partners,
4. take the union of seeds and both partner hops,
5. retain directed internal edges between selected neurons with source weight threshold `1`,
6. preserve source body IDs, directed edge weights, type/instance metadata, recorded soma side, and neurotransmitter prediction when those fields are present upstream.

Missing upstream metadata remains missing; the exporter must not invent biological values. Body IDs are serialized as decimal strings so the files remain safe across JavaScript and other tooling.

## Derived browser assets

The V1 browser data directory is `public/data/male-cns-v1/` and contains:

- `circuit.bin` — compact hot-path directed edge table,
- `metadata.json` — neuron identity/annotation data plus Neural Brush role flags,
- `manifest.json` — dataset/circuit identifiers, counts, seed selectors, UTC generation time, and SHA-256 hashes of the raw snapshot and packed binary.

The packer enforces a combined uncompressed ceiling of **10 MiB** for these three browser files.

`inputPort`, behavior-port groupings, and any later simulation state are Neural Brush modeling metadata. They are not upstream MaleCNS annotations unless explicitly identified as such.

## Licensing boundary

The repository's original Neural Brush application code is licensed under the **MIT License**. That MIT license does **not** relicense MaleCNS source data or MaleCNS-derived data. The derived connectome assets retain the upstream **CC-BY** attribution/licensing obligation.

Third-party software used to query or transform the dataset, including the `malecns`/natverse ecosystem, retains its own software license independently of both the Neural Brush MIT code and the MaleCNS data license.
