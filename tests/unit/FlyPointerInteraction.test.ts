import { describe, expect, it } from 'vitest';
import { FlyPointerInteraction } from '../../src/fly/FlyPointerInteraction';

describe('FlyPointerInteraction', () => {
  it('starts dragging when pointer-down hits the fly', () => {
    const events: string[] = [];
    const interaction = new FlyPointerInteraction({
      onDragStart: (x, y) => events.push(`start:${x}:${y}`),
      onDrag: () => undefined,
      onDragEnd: () => events.push('end'),
      onFollowTarget: () => events.push('follow'),
    });

    const result = interaction.pointerDown(0.52, 0.49, 0.5, 0.5);

    expect(result).toBe('dragging');
    expect(interaction.isDragging).toBe(true);
    expect(events).toEqual(['start:0.52:0.49']);
  });

  it('sets a follow target when pointer-down misses the fly', () => {
    const targets: Array<[number, number]> = [];
    const interaction = new FlyPointerInteraction({
      onDragStart: () => undefined,
      onDrag: () => undefined,
      onDragEnd: () => undefined,
      onFollowTarget: (x, y) => targets.push([x, y]),
    });

    const result = interaction.pointerDown(0.9, 0.1, 0.5, 0.5);

    expect(result).toBe('followTarget');
    expect(interaction.isDragging).toBe(false);
    expect(targets).toEqual([[0.9, 0.1]]);
  });

  it('clamps drag coordinates to 0..1', () => {
    const drags: Array<[number, number]> = [];
    const interaction = new FlyPointerInteraction({
      onDragStart: () => undefined,
      onDrag: (x, y) => drags.push([x, y]),
      onDragEnd: () => undefined,
      onFollowTarget: () => undefined,
    });

    interaction.pointerDown(0.5, 0.5, 0.5, 0.5);
    interaction.pointerMove(2, -3);

    expect(drags).toEqual([[1, 0]]);
  });

  it('ends drag on pointer-up and ignores later moves', () => {
    let dragCount = 0;
    let endCount = 0;
    const interaction = new FlyPointerInteraction({
      onDragStart: () => undefined,
      onDrag: () => { dragCount += 1; },
      onDragEnd: () => { endCount += 1; },
      onFollowTarget: () => undefined,
    });

    interaction.pointerDown(0.5, 0.5, 0.5, 0.5);
    interaction.pointerUp();
    interaction.pointerMove(0.8, 0.8);

    expect(interaction.isDragging).toBe(false);
    expect(endCount).toBe(1);
    expect(dragCount).toBe(0);
  });

  it('uses a bounded normalized hit radius', () => {
    const interaction = new FlyPointerInteraction({
      onDragStart: () => undefined,
      onDrag: () => undefined,
      onDragEnd: () => undefined,
      onFollowTarget: () => undefined,
    }, 0.05);

    expect(interaction.pointerDown(0.55, 0.5, 0.5, 0.5)).toBe('dragging');
    interaction.pointerUp();
    expect(interaction.pointerDown(0.551, 0.5, 0.5, 0.5)).toBe('followTarget');
  });
});
