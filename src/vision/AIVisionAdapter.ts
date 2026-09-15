export interface SemanticMask {
  label: string;
  width: number;
  height: number;
  values: Float32Array;
}

export interface SemanticMaskSet {
  masks: readonly SemanticMask[];
}

export interface AIVisionAdapter {
  analyze(image: ImageBitmap): Promise<SemanticMaskSet | null>;
}

export class NullAIVisionAdapter implements AIVisionAdapter {
  async analyze(image: ImageBitmap): Promise<SemanticMaskSet | null> {
    void image;
    return null;
  }
}
