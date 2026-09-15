export interface NodeVisual {
  scale: number;
  brightness: number;
}

const clamp01 = (value: number): number =>
  Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

export function nodeVisual(activation: number): NodeVisual {
  const activity = clamp01(activation);
  return {
    scale: 0.72 + activity * 1.18,
    brightness: 0.22 + activity * 0.78,
  };
}

export function edgeVisualIntensity(
  sourceActivation: number,
  sourceWeight: number,
): number {
  const activity = clamp01(sourceActivation);
  const weight = Number.isFinite(sourceWeight) && sourceWeight > 0 ? sourceWeight : 0;
  const weightVisual = Math.tanh(Math.log1p(weight) / 6);
  return clamp01(0.04 + activity * weightVisual * 0.96);
}
