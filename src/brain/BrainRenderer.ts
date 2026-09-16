import * as THREE from 'three';
import type { CircuitGraph } from './CircuitGraph';
import { BrainLayout } from './BrainLayout';
import { nodeVisual } from './BrainVisuals';

const NODE_RADIUS = 0.035;

export class BrainRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1.15, 1.15, 1.05, -1.05, 0.1, 10);
  private readonly positions: Float32Array;
  private readonly nodeGeometry = new THREE.SphereGeometry(NODE_RADIUS, 8, 6);
  private readonly nodeMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
  private readonly nodes: THREE.InstancedMesh;
  private readonly edgeGeometry = new THREE.BufferGeometry();
  private readonly edgeMaterial = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.5,
  });
  private readonly edges: THREE.LineSegments;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly resizeObserver: ResizeObserver;
  private selectedIndex = 0;
  private disposed = false;
  private lastActivation = new Float32Array(0);

  constructor(
    private readonly host: HTMLElement,
    private readonly graph: CircuitGraph,
    private readonly onSelect: (index: number) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, Math.max(1, window.devicePixelRatio)));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.domElement.className = 'brain-canvas';
    this.renderer.domElement.setAttribute('aria-label', 'Live MaleCNS graph');
    this.renderer.domElement.setAttribute('role', 'img');

    this.camera.position.z = 3;
    this.positions = BrainLayout.compute(graph);
    this.nodes = new THREE.InstancedMesh(
      this.nodeGeometry,
      this.nodeMaterial,
      graph.metadata.neurons.length,
    );
    this.nodes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const edgePositions = new Float32Array(graph.edges.length * 6);
    const edgeColors = new Float32Array(graph.edges.length * 6);
    graph.edges.forEach((edge, edgeIndex) => {
      const sourceOffset = edge.sourceIndex * 3;
      const targetOffset = edge.targetIndex * 3;
      const offset = edgeIndex * 6;
      edgePositions[offset] = this.positions[sourceOffset];
      edgePositions[offset + 1] = this.positions[sourceOffset + 1];
      edgePositions[offset + 2] = this.positions[sourceOffset + 2];
      edgePositions[offset + 3] = this.positions[targetOffset];
      edgePositions[offset + 4] = this.positions[targetOffset + 1];
      edgePositions[offset + 5] = this.positions[targetOffset + 2];
      edgeColors[offset] = 0.08;
      edgeColors[offset + 1] = 0.18;
      edgeColors[offset + 2] = 0.22;
      edgeColors[offset + 3] = 0.08;
      edgeColors[offset + 4] = 0.18;
      edgeColors[offset + 5] = 0.22;
    });
    this.edgeGeometry.setAttribute('position', new THREE.BufferAttribute(edgePositions, 3));
    this.edgeGeometry.setAttribute('color', new THREE.BufferAttribute(edgeColors, 3));
    this.edges = new THREE.LineSegments(this.edgeGeometry, this.edgeMaterial);

    this.scene.add(this.edges, this.nodes);
    this.host.replaceChildren(this.renderer.domElement);

    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDown);
    this.resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) return;
      this.resize(entry.contentRect.width, entry.contentRect.height);
    });
    this.resizeObserver.observe(host);

    this.updateActivation(new Float32Array(graph.metadata.neurons.length));
  }

  select(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.graph.metadata.neurons.length) {
      throw new RangeError(`brain node index ${index} is outside the graph`);
    }
    this.selectedIndex = index;
    this.renderNodes(this.lastActivation);
    this.render();
  }

  updateActivation(activation: Float32Array): void {
    if (activation.length !== this.graph.metadata.neurons.length) {
      throw new RangeError(
        `activation length ${activation.length} does not match ${this.graph.metadata.neurons.length} neurons`,
      );
    }
    this.lastActivation = activation.slice();
    this.renderNodes(activation);
    this.render();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDown);
    this.nodeGeometry.dispose();
    this.nodeMaterial.dispose();
    this.edgeGeometry.dispose();
    this.edgeMaterial.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private renderNodes(activation: Float32Array): void {
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const color = new THREE.Color();

    for (let index = 0; index < this.graph.metadata.neurons.length; index += 1) {
      const offset = index * 3;
      const visual = nodeVisual(activation[index] ?? 0);
      const selectedBoost = index === this.selectedIndex ? 1.35 : 1;
      position.set(
        this.positions[offset],
        this.positions[offset + 1],
        this.positions[offset + 2],
      );
      scale.setScalar(visual.scale * selectedBoost);
      matrix.compose(position, quaternion, scale);
      this.nodes.setMatrixAt(index, matrix);

      if (index === this.selectedIndex) {
        color.setRGB(1, 0.92, 0.6);
      } else {
        const brightness = visual.brightness;
        color.setRGB(0.18 * brightness, 0.72 * brightness, brightness);
      }
      this.nodes.setColorAt(index, color);
    }
    this.nodes.instanceMatrix.needsUpdate = true;
    if (this.nodes.instanceColor) this.nodes.instanceColor.needsUpdate = true;
  }

  private resize(width: number, height: number): void {
    const safeWidth = Math.max(1, Math.floor(width));
    const safeHeight = Math.max(1, Math.floor(height));
    this.renderer.setSize(safeWidth, safeHeight, false);
    this.render();
  }

  private render(): void {
    if (this.disposed) return;
    this.renderer.render(this.scene, this.camera);
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObject(this.nodes, false)[0];
    if (hit?.instanceId === undefined) return;
    this.selectedIndex = hit.instanceId;
    this.onSelect(hit.instanceId);
    this.renderNodes(this.lastActivation);
    this.render();
  };
}
