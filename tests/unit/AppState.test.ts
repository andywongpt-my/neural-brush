import { describe, expect, it } from 'vitest';
import { AppState } from '../../src/app/AppState';

describe('AppState split ratio', () => {
  it('starts at the approved 58/42 ratio', () => {
    expect(new AppState().getSnapshot().splitRatio).toBe(0.58);
  });

  it('clamps the draggable divider to safe bounds', () => {
    const state = new AppState();
    state.setSplitRatio(0.1);
    expect(state.getSnapshot().splitRatio).toBe(0.35);
    state.setSplitRatio(0.95);
    expect(state.getSnapshot().splitRatio).toBe(0.75);
  });
});
