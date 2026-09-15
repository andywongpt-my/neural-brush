export interface FlyState {
  x: number;
  y: number;
  heading: number;
  speed: number;
  velocityX: number;
  velocityY: number;
}

export type FlyControlMode = 'autonomous' | 'followTarget' | 'dragging';

export interface FlyTarget {
  x: number;
  y: number;
}
