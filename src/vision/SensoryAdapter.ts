import type { SensorySample } from './LocalVision';

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export class SensoryAdapter {
  static map(
    sample: SensorySample,
    inputPortIndices: Uint32Array,
    nodeCount: number,
  ): Float32Array {
    if (!Number.isInteger(nodeCount) || nodeCount <= 0) {
      throw new RangeError('nodeCount must be a positive integer');
    }

    const features = [
      sample.luminance,
      sample.saturation,
      sample.contrast,
      sample.edge,
      sample.motion,
    ];
    for (const value of features) {
      if (!Number.isFinite(value)) {
        throw new RangeError('sensory features must be finite');
      }
    }

    const drive = new Float32Array(nodeCount);
    inputPortIndices.forEach((nodeIndex, ordinal) => {
      if (nodeIndex >= nodeCount) {
        throw new RangeError(`input port index ${nodeIndex} is outside nodeCount ${nodeCount}`);
      }
      drive[nodeIndex] = clamp01(features[ordinal % features.length]);
    });
    return drive;
  }
}
