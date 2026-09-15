# MaleCNS raw circuit schema

Neural Brush V1 uses a deterministic **DNa steering-centered upstream subgraph** derived from the public `male-cns:v1.0` dataset. The source exporter writes `tools/malecns-export/out/raw-circuit.json`; the browser-facing packer later produces `public/data/male-cns-v1/metadata.json`, `manifest.json`, and `circuit.bin`.

## Scientific boundary

The selected graph preserves source neuron identity, directed connectivity, source edge weight, annotations, soma-side metadata when available, and neurotransmitter predictions when available. Missing biological metadata remains missing; the exporter must not invent values.

The selected frontier/input-port neurons are graph-boundary nodes, **not automatically retinal or visual neurons**. Neural Brush later injects local photo-derived signals through a synthetic sensory-adapter layer. That adapter is application modeling logic and must not be presented as a native MaleCNS sensory pathway.

Likewise, DNa01/DNa02 are used as descending steering seeds. `turnLeft`, `turnRight`, and aggregate `forward` are application behavior readouts built from verified seed metadata; they are not claims that the connectome contains artistic brush outputs.

## Raw JSON

The raw JSON object contains:

- `dataset`: exactly `male-cns:v1.0`.
- `circuit`: exactly `dna-steering-v1`.
- `selection`: the exact deterministic selection configuration used to produce the snapshot.
- `neurons[]`: source neurons with decimal-string `bodyId`, nullable `type`, `instance`, `somaSide`, and neurotransmitter fields plus derived boolean role flags.
- `edges[]`: directed internal edges with decimal-string `source` and `target` body IDs and positive integer source `weight`.
- `behaviorPorts`: verified left/right/forward seed body-ID arrays.

Body IDs are serialized as decimal strings to avoid accidental precision loss across tools. Edge ordering and neuron ordering are deterministic so identical upstream data and selection configuration can be hashed and packed reproducibly.

## Selection configuration

`circuit-selection.json` pins the dataset, seed types, hop direction, thresholds, partner limits, and internal-edge threshold. V1 starts from `DNa01` and `DNa02`, expands two bounded incoming hops, then retains only edges whose endpoints are inside the selected set.

The browser must never require the complete MaleCNS graph. The committed packed V1 payload must remain at or below 10 MiB before normal HTTP compression.
