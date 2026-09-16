import type { CircuitGraph } from '../brain/CircuitGraph';

export interface NeuronInspectorControls {
  onStimulate(bodyId: string, value: number): void;
  onInhibit(bodyId: string, value: number): void;
  onConnectionGain(edgeIndex: number, value: number): void;
}

interface InspectorState {
  stimulation: Map<string, number>;
  inhibition: Map<string, number>;
  gains: Map<number, number>;
}

export class NeuronInspector {
  private host: HTMLElement | null = null;
  private selectedNeuronIndex = 0;
  private selectedEdgeIndex: number | null = null;
  private readonly state: InspectorState = {
    stimulation: new Map(),
    inhibition: new Map(),
    gains: new Map(),
  };

  constructor(
    private readonly graph: CircuitGraph,
    private readonly controls: NeuronInspectorControls,
    private readonly onSelectNeuron?: (index: number) => void,
  ) {}

  mount(host: HTMLElement): void {
    this.host = host;
    this.selectedNeuronIndex = Math.min(
      this.selectedNeuronIndex,
      Math.max(0, this.graph.metadata.neurons.length - 1),
    );
    this.render();
  }

  selectNeuron(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.graph.metadata.neurons.length) {
      throw new RangeError(`neuron index ${index} is outside the graph`);
    }
    this.selectedNeuronIndex = index;
    this.selectedEdgeIndex = null;
    this.render();
  }

  reset(): void {
    this.state.stimulation.clear();
    this.state.inhibition.clear();
    this.state.gains.clear();
    this.render();
  }

  private relatedEdges(index: number): number[] {
    const result: number[] = [];
    this.graph.edges.forEach((edge, edgeIndex) => {
      if (edge.sourceIndex === index || edge.targetIndex === index) result.push(edgeIndex);
    });
    return result;
  }

  private render(): void {
    if (!this.host || this.graph.metadata.neurons.length === 0) return;
    const neuron = this.graph.metadata.neurons[this.selectedNeuronIndex];
    const relatedEdges = this.relatedEdges(this.selectedNeuronIndex);
    if (this.selectedEdgeIndex === null || !relatedEdges.includes(this.selectedEdgeIndex)) {
      this.selectedEdgeIndex = relatedEdges[0] ?? null;
    }

    const root = document.createElement('div');
    root.className = 'neuron-inspector';

    const selectorLabel = document.createElement('label');
    selectorLabel.className = 'inspector-selector';
    selectorLabel.textContent = 'Neuron';
    const selector = document.createElement('select');
    selector.setAttribute('aria-label', 'Neuron');
    this.graph.metadata.neurons.forEach((candidate, index) => {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = `${candidate.type ?? 'Unannotated'} · ${candidate.bodyId}`;
      option.selected = index === this.selectedNeuronIndex;
      selector.append(option);
    });
    selector.addEventListener('change', () => {
      const next = Number(selector.value);
      this.selectedNeuronIndex = next;
      this.selectedEdgeIndex = null;
      this.onSelectNeuron?.(next);
      this.render();
    });
    selectorLabel.append(selector);

    const sourceSection = document.createElement('section');
    sourceSection.className = 'inspector-section';
    const sourceHeading = document.createElement('h3');
    sourceHeading.textContent = 'Source facts';
    const facts = document.createElement('dl');
    facts.append(
      this.fact('Dataset', this.graph.metadata.dataset),
      this.fact('Body ID', neuron.bodyId),
      this.fact('Type', neuron.type ?? 'Unknown'),
      this.fact('Instance', neuron.instance ?? 'Unknown'),
      this.fact('Soma side', neuron.somaSide),
      this.fact('Neurotransmitter prediction', neuron.neurotransmitter ?? 'Unknown'),
    );

    const edgeLabel = document.createElement('label');
    edgeLabel.className = 'inspector-selector';
    edgeLabel.textContent = 'Connection';
    const edgeSelect = document.createElement('select');
    edgeSelect.setAttribute('aria-label', 'Connection');
    if (relatedEdges.length === 0) {
      const option = document.createElement('option');
      option.textContent = 'No incident connection';
      option.value = '';
      edgeSelect.append(option);
      edgeSelect.disabled = true;
    } else {
      relatedEdges.forEach((edgeIndex) => {
        const edge = this.graph.edges[edgeIndex];
        const source = this.graph.metadata.neurons[edge.sourceIndex].bodyId;
        const target = this.graph.metadata.neurons[edge.targetIndex].bodyId;
        const option = document.createElement('option');
        option.value = String(edgeIndex);
        option.textContent = `${source} → ${target}`;
        option.selected = edgeIndex === this.selectedEdgeIndex;
        edgeSelect.append(option);
      });
      edgeSelect.addEventListener('change', () => {
        this.selectedEdgeIndex = Number(edgeSelect.value);
        this.render();
      });
    }
    edgeLabel.append(edgeSelect);

    const rawWeight =
      this.selectedEdgeIndex === null
        ? '—'
        : String(this.graph.sourceWeights[this.selectedEdgeIndex]);
    facts.append(this.fact('Raw source weight', rawWeight));
    sourceSection.append(sourceHeading, selectorLabel, facts, edgeLabel);

    const simulationSection = document.createElement('section');
    simulationSection.className = 'inspector-section';
    const simulationHeading = document.createElement('h3');
    simulationHeading.textContent = 'Simulation controls';

    const stimulation = this.rangeControl(
      'Stimulation',
      0,
      1,
      0.01,
      this.state.stimulation.get(neuron.bodyId) ?? 0,
      (value) => {
        this.state.stimulation.set(neuron.bodyId, value);
        this.controls.onStimulate(neuron.bodyId, value);
      },
    );
    const inhibition = this.rangeControl(
      'Inhibition',
      0,
      1,
      0.01,
      this.state.inhibition.get(neuron.bodyId) ?? 0,
      (value) => {
        this.state.inhibition.set(neuron.bodyId, value);
        this.controls.onInhibit(neuron.bodyId, value);
      },
    );

    const gain = this.rangeControl(
      'Connection modulation',
      0,
      2,
      0.01,
      this.selectedEdgeIndex === null
        ? 1
        : (this.state.gains.get(this.selectedEdgeIndex) ?? 1),
      (value) => {
        if (this.selectedEdgeIndex === null) return;
        this.state.gains.set(this.selectedEdgeIndex, value);
        this.controls.onConnectionGain(this.selectedEdgeIndex, value);
      },
    );
    if (this.selectedEdgeIndex === null) {
      gain.querySelector('input')?.setAttribute('disabled', 'true');
    }

    simulationSection.append(simulationHeading, stimulation, inhibition, gain);
    root.append(sourceSection, simulationSection);
    this.host.replaceChildren(root);
  }

  private fact(label: string, value: string): HTMLElement {
    const row = document.createElement('div');
    row.className = 'inspector-fact';
    const term = document.createElement('dt');
    term.textContent = label;
    const description = document.createElement('dd');
    description.textContent = value;
    row.append(term, description);
    return row;
  }

  private rangeControl(
    labelText: string,
    min: number,
    max: number,
    step: number,
    value: number,
    onInput: (value: number) => void,
  ): HTMLElement {
    const label = document.createElement('label');
    label.className = 'modulation-control';
    const header = document.createElement('span');
    header.textContent = labelText;
    const output = document.createElement('output');
    output.textContent = value.toFixed(2);
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    input.setAttribute('aria-label', labelText);
    input.addEventListener('input', () => {
      const next = Number(input.value);
      output.textContent = next.toFixed(2);
      onInput(next);
    });
    header.append(output);
    label.append(header, input);
    return label;
  }
}
