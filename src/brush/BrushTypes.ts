export type BrushMode = 'smear' | 'saturation' | 'glow' | 'blend';

export interface BrushFrame {
  centerX: number;
  centerY: number;
  velocityX: number;
  velocityY: number;
  radius: number;
  smear: number;
  saturation: number;
  glow: number;
}
