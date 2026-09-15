# Neural Brush Scientific Scope

Neural Brush is a creative photo-editing system constrained by a selected MaleCNS connectome subgraph. This document separates **source connectome facts** from **Neural Brush modeling assumptions** so the application does not present creative behavior as reconstructed Drosophila physiology.

## Source-derived facts

The V1 data pipeline targets the public Janelia FlyEM Male CNS dataset `male-cns:v1.0`.

Within the selected subgraph, Neural Brush preserves the following source-derived fields when available:

- neuron body ID,
- neuron type and instance annotation,
- directed connectivity,
- source connection weight,
- recorded soma-side metadata,
- predicted neurotransmitter metadata.

The browser graph is a **selected subgraph**, not the complete male central nervous system. The current deterministic selection starts from DNa01/DNa02 seed types and expands two bounded incoming-partner hops according to [`circuit-selection.json`](../tools/malecns-export/circuit-selection.json).

The packed source edge weights remain immutable at runtime. User controls operate through a separate modulation layer rather than overwriting the source graph.

## Neural Brush modeling boundaries

The following concepts are created by Neural Brush and must not be described as upstream connectome annotations.

### Frontier `inputPort`

An `inputPort` marks a graph boundary in the selected Neural Brush subgraph: a selected node with no incoming edge from another selected node. It does **not** mean that the neuron is a retinal neuron, photoreceptor, or verified visual-input neuron.

### Photo-derived sensory input

Brightness, color, contrast, edges, and motion-like local features sampled from the user's photo are **synthetic external stimuli**. The V1 `SensoryAdapter` deterministically maps those values into selected circuit frontier nodes. That mapping is application logic, not a reconstruction of the fly retina or a claim that a photographed image enters the real MaleCNS through those exact neurons.

Until the later GPU brush pipeline provides edited-pixel readback, Plan 3 samples the locally decoded source image. No image upload is required for this sensory path.

Optional AI semantic masks, if introduced later, are also external synthetic modulation and must remain explicitly labeled as such.

### Behavior readouts

DNa01/DNa02 are used as descending steering-centered seeds. Published physiology shows that activity in these bilateral neurons predicts steering, with the right-left activity difference related to rotational velocity; activity on one side is associated with ipsilateral steering. The exporter therefore uses source `somaSide` metadata to define `turnLeft` and `turnRight`, and it refuses to guess laterality when source metadata is insufficient.

V1 deliberately leaves the source-data `forward` behavior port empty. DNa01/DNa02 are not treated as a verified forward-speed command. In the current runtime this makes the source-derived forward readout exactly `0`; `dwell` is then the explicit modeling relation `clamp01(1 - forward)`, so it is `1` when no verified forward port exists. These values keep the runtime interface stable but must not be described as discovered MaleCNS forward/dwell channels.

The V1 behavior interface contains only:

- `turn` — bounded right-minus-left steering readout,
- `forward` — mean activity of verified forward ports, currently `0` because that port set is empty,
- `dwell` — Neural Brush modeling complement of `forward`,
- `arousal` — Neural Brush aggregate mean simulated activation.

A future nonzero forward-drive readout must be selected from separate biological evidence before source-data forward ports can be populated.

Reference: *Neural circuit mechanisms for steering control in walking Drosophila*, eLife, DOI `10.7554/eLife.102230`.

These behavior ports remain application-facing readout interfaces; they do not imply that MaleCNS itself contains Neural Brush-specific channels or artistic outputs.

### Neural dynamics

The V1 runtime uses simplified connectome-constrained dynamics in a Web Worker. Source topology and source weights constrain propagation, but the activation equation is a Neural Brush model rather than measured electrophysiology.

For each directed edge, the runtime computes a bounded weight transform:

`normalizedWeight = tanh(log1p(sourceWeight) / 4)`

and propagates:

`activation[source] * normalizedWeight * connectionGain`

where user `connectionGain` is a reversible modulation multiplier bounded to `0..2`. The packed source weight itself is never modified.

Each neuron then receives synthetic external drive plus optional user stimulation/inhibition, passes the accumulated value through a sigmoid, approaches that target with a fixed logical time constant, and receives very small seeded bounded noise. The simulation advances at a fixed logical 60 Hz and publishes state at approximately 30 Hz; wall-clock scheduling does not change the logical timestep.

These constants and equations are modeling assumptions. This is **not** an electrophysiological reconstruction. The connectome alone does not uniquely specify membrane dynamics, receptor effects, neuromodulation, synaptic kinetics, or all other physiological parameters needed for such a reconstruction.

Predicted neurotransmitter labels are therefore shown as source metadata; Neural Brush must not blindly convert a neurotransmitter label into a universal excitatory/inhibitory sign without additional biological evidence.

### Artistic brush output

`Smear`, `Saturation`, and `Glow` are creative image-processing effects. The neural layer outputs behavior-level state; the later brush layer converts fly motion/state into artistic parameters.

There is no claim that MaleCNS contains a “Smear neuron,” “Glow neuron,” or any biological output corresponding directly to a photo-editor effect.

## Feedback loop

Neural Brush is designed as a live closed interaction loop:

1. the fly samples local features from the current image,
2. the sensory adapter supplies external simulation input,
3. activity propagates through the connectome-derived subgraph,
4. behavior readouts update fly movement,
5. fly movement drives the artistic brush,
6. the edited pixels become the next visual sample.

Plan 3 implements steps 1–4 against the locally decoded source image. Plan 4 adds the artistic GPU brush and edited-pixel feedback required to close steps 5–6.

The feedback loop is real application state, but its physiological interpretation remains limited by the modeling boundaries above.

## Recommended wording

Appropriate descriptions include:

- “MaleCNS-derived circuit”
- “connectome-constrained simulation”
- “selected MaleCNS subgraph”
- “simplified neural dynamics”

Avoid descriptions such as:

- “complete fruit-fly brain simulation”
- “full biological/electrophysiological reconstruction”
- claims that Neural Brush artistic effects are native motor outputs of the fly nervous system.

For dataset provenance and licensing, see [`data-attribution.md`](data-attribution.md).
