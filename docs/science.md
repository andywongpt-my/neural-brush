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

The packed source edge weights remain immutable at runtime. Later user controls operate through a separate modulation layer rather than overwriting the source graph.

## Neural Brush modeling boundaries

The following concepts are created by Neural Brush and must not be described as upstream connectome annotations.

### Frontier `inputPort`

An `inputPort` marks a graph boundary in the selected Neural Brush subgraph: a selected node with no incoming edge from another selected node. It does **not** mean that the neuron is a retinal neuron, photoreceptor, or verified visual-input neuron.

### Photo-derived sensory input

Brightness, color, contrast, edges, and other local features sampled from the user's photo are **synthetic external stimuli**. A `SensoryAdapter` later maps those values into the selected circuit. That mapping is application logic, not a reconstruction of the fly retina or a claim that a photographed image enters the real MaleCNS through those exact neurons.

Optional AI semantic masks, if introduced later, are also external synthetic modulation and must remain explicitly labeled as such.

### Behavior readouts

DNa01/DNa02 are used as descending steering-centered seeds. The pipeline accepts left/right groupings only when upstream soma-side metadata supplies `L`/`R`; it does not infer laterality from names.

Neural Brush then defines application readouts such as `turnLeft`, `turnRight`, and aggregate `forward`. These readouts are modeling interfaces used to control fly movement. They are not claims that MaleCNS itself contains Neural Brush-specific behavior channels.

### Neural dynamics

Later runtime activity uses simplified connectome-constrained dynamics: source topology and weights constrain propagation, while decay, thresholds/nonlinearities, bounded noise, stimulation, inhibition, and other state variables are model parameters.

This is **not** an electrophysiological reconstruction. The connectome alone does not uniquely specify membrane dynamics, receptor effects, neuromodulation, synaptic kinetics, or all other physiological parameters needed for such a reconstruction.

Predicted neurotransmitter labels are therefore shown as source metadata; Neural Brush must not blindly convert a neurotransmitter label into a universal excitatory/inhibitory sign without additional biological evidence.

### Artistic brush output

`Smear`, `Saturation`, and `Glow` are creative image-processing effects. The neural layer outputs behavior-level state such as turning, forward drive, dwell, and aggregate activity; the artistic layer maps that state to brush parameters.

There is no claim that MaleCNS contains a “Smear neuron,” “Glow neuron,” or any biological output corresponding directly to a photo-editor effect.

## Feedback loop

Neural Brush is designed as a live closed interaction loop:

1. the fly samples local features from the current image,
2. the sensory adapter supplies external simulation input,
3. activity propagates through the connectome-derived subgraph,
4. behavior readouts update fly movement,
5. fly movement drives the artistic brush,
6. the edited pixels become the next visual sample.

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
