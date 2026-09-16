# Neural Brush Scientific Scope

Neural Brush is a creative photo-editing system constrained by a selected MaleCNS connectome subgraph. This document separates **connectome-derived source facts** from **Neural Brush modeling assumptions and artistic mappings** so the application does not present creative behavior as reconstructed Drosophila physiology.

## Required scientific disclosure

Neural Brush V1 uses a selected subgraph derived from MaleCNS `male-cns:v1.0`.

Within that selected subgraph, source topology, neuron identifiers, source connection weights, and available annotations are connectome-derived. Neural Brush keeps those source facts separate from reversible runtime modulation and from the application-specific sensory, behavior, fly, and brush layers.

The neural activity equations used by Neural Brush are **simplified modeling assumptions, not reconstructed electrophysiology**.

Photo feature injection is a **synthetic sensory adapter**. It is not a reconstruction of the fly retina or proof that a photographed image biologically enters MaleCNS through the selected frontier neurons.

`Smear`, `Saturation`, and `Glow` are **artistic mappings, not biological motor outputs**.

Any future optional AI semantic vision would be **external synthetic modulation** and must be clearly labeled as such.

## Source-derived facts

The V1 data pipeline targets the public Janelia FlyEM Male CNS dataset `male-cns:v1.0`.

Within the selected subgraph, Neural Brush preserves the following source-derived fields when available:

- neuron body ID,
- neuron type and instance annotation,
- directed connectivity,
- source connection weight,
- recorded soma-side metadata,
- predicted/consensus neurotransmitter metadata.

The browser graph is a **selected subgraph**, not the complete male central nervous system. The current deterministic selection starts from DNa01/DNa02 seed types and expands two bounded incoming-partner hops according to [`circuit-selection.json`](../tools/malecns-export/circuit-selection.json).

The packed source edge weights remain immutable at runtime. User controls operate through a separate `ModulationLayer`; connection gain is a multiplier over a source edge and never rewrites the packed source weight.

## Frontier `inputPort`

An `inputPort` marks a graph boundary in the selected Neural Brush subgraph: a selected node with no incoming edge from another selected node.

It does **not** mean that the neuron is a retinal neuron, photoreceptor, or verified visual-input neuron. The port is an application-facing boundary used by the synthetic sensory adapter.

## Photo-derived sensory input

The live V1 loop samples the **currently edited image**, not merely the original source bitmap.

`EditedImageSampler` reads a small local patch around the fly position from the GPU brush target. Brightness, local color, contrast, edge, and motion-like features are converted by `SensoryAdapter` into external simulation drive for selected circuit frontier nodes.

These signals are synthetic external stimuli. Their mapping is Neural Brush application logic, not an upstream MaleCNS annotation or a reconstruction of the Drosophila visual system.

Because the edited texture is sampled again after brush changes, the fly's own artistic edits can alter subsequent sensory drive and therefore later neural/fly behavior. That closed loop is real software state, while its physiological interpretation remains bounded by the assumptions described here.

Optional future AI semantic masks or object/scene understanding would also be external synthetic modulation and must remain explicit opt-in rather than being presented as a discovered MaleCNS pathway.

## Behavior readouts

DNa01/DNa02 are used as descending steering-centered seeds. Published physiology shows that activity in these bilateral neurons predicts steering, with the right-left activity difference related to rotational velocity; activity on one side is associated with ipsilateral steering. The exporter therefore uses source `somaSide` metadata to define `turnLeft` and `turnRight`, and it refuses to guess laterality when source metadata is insufficient.

V1 deliberately leaves the source-data `forward` behavior port empty. DNa01/DNa02 are not treated as a verified forward-speed command. In the current runtime this makes the source-derived forward readout exactly `0`; `dwell` is then the explicit modeling relation `clamp01(1 - forward)`, so it is `1` when no verified forward port exists. These values keep the runtime interface stable but must not be described as discovered MaleCNS forward/dwell channels.

The V1 behavior interface contains:

- `turn` — bounded right-minus-left steering readout,
- `forward` — mean activity of verified forward ports, currently `0` because that port set is empty,
- `dwell` — Neural Brush modeling complement of `forward`,
- `arousal` — Neural Brush aggregate mean simulated activation.

A future nonzero forward-drive readout must be selected from separate biological evidence before source-data forward ports can be populated.

Reference: *Neural circuit mechanisms for steering control in walking Drosophila*, eLife, DOI `10.7554/eLife.102230`.

These behavior ports remain application-facing readout interfaces; they do not imply that MaleCNS itself contains Neural Brush-specific channels or artistic outputs.

## Neural dynamics

The V1 runtime uses simplified connectome-constrained dynamics in a Web Worker. Source topology and source weights constrain propagation, but the activation equation is a Neural Brush model rather than measured electrophysiology.

For each directed edge, the runtime computes a bounded weight transform:

`normalizedWeight = tanh(log1p(sourceWeight) / 4)`

and propagates:

`activation[source] * normalizedWeight * connectionGain`

where user `connectionGain` is a reversible modulation multiplier bounded to `0..2`. The packed source weight itself is never modified.

Each neuron receives synthetic external drive plus optional user stimulation/inhibition, passes the accumulated value through a sigmoid, approaches that target using the runtime's simplified update rule, and receives very small seeded bounded noise.

The simulation advances at a fixed logical **60 Hz**, publishes worker state at approximately **30 Hz**, and receives edited-image sensory samples at **30 Hz**. Visible fly/brush rendering is driven by `requestAnimationFrame`; the Brain graph visualization is throttled independently.

These constants and equations are modeling assumptions. Neural Brush is **not** an electrophysiological reconstruction. The connectome alone does not uniquely specify membrane dynamics, receptor effects, neuromodulation, synaptic kinetics, or the other physiological parameters needed for a complete reconstruction.

Predicted neurotransmitter labels are therefore displayed as source metadata. Neural Brush does not blindly convert a neurotransmitter label into a universal excitatory/inhibitory sign without additional biological evidence.

## Artistic brush output

`Smear`, `Saturation`, and `Glow` are creative image-processing effects. The neural layer outputs behavior-level state; fly motion/state and application mapping logic drive artistic brush parameters.

There is no claim that MaleCNS contains a “Smear neuron,” “Glow neuron,” or any biological output corresponding directly to a photo-editor effect.

`Blend` combines the artistic effects; it is likewise an application mode, not a biological state.

## Live closed feedback loop

The implemented V1 loop is:

1. the fly samples local features from the current edited image,
2. the synthetic sensory adapter supplies external simulation input,
3. activity propagates through the MaleCNS-derived selected graph under simplified dynamics,
4. behavior readouts update fly movement,
5. fly movement/state drives the artistic brush,
6. the brush modifies the GPU image target,
7. the edited pixels become the next local visual sample.

This loop is continuous while the Brain is ready and a photo is loaded.

## User manipulation and source facts

Users may:

- stimulate a selected neuron,
- inhibit a selected neuron,
- scale the gain of an existing selected connection within `0..2×`,
- choose brush mode,
- save/share those deltas as a Brain Preset.

Users do not, in V1:

- add fake neurons,
- arbitrarily rewire the graph,
- overwrite source body IDs/types,
- overwrite source connection weights,
- convert artistic outputs into purported biological annotations.

In short: users can alter **simulation state**, not rewrite **source facts**.

## Privacy and scientific interpretation

Static V1 processes the user's source photo locally in the browser. The photo is not part of the MaleCNS data, is not placed into Brain Presets/share fragments, and requires no backend or cloud photo store for the core app.

This privacy boundary does not make the synthetic sensory mapping biologically real; it only describes where the user's image is processed.

## Recommended wording

Appropriate descriptions include:

- “MaleCNS-derived circuit”
- “connectome-constrained simulation”
- “selected MaleCNS subgraph”
- “simplified neural dynamics”
- “synthetic sensory adapter”
- “artistic mapping”

Avoid descriptions such as:

- “complete fruit-fly brain simulation”
- “full biological/electrophysiological reconstruction”
- “the fly literally sees the uploaded photo through these neurons”
- claims that Neural Brush artistic effects are native biological motor outputs.

For data provenance/licensing, see [`data-attribution.md`](data-attribution.md). For software data flow and timing, see [`architecture.md`](architecture.md).
