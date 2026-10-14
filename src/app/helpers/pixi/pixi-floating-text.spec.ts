import { gatherVfxFloatState } from '@helpers/pixi/pixi-floating-text';
import { describe, expect, it } from 'vitest';

describe('gatherVfxFloatState', () => {
  it('starts fully opaque with no drift at t=0', () => {
    const state = gatherVfxFloatState(0);

    expect(state?.alpha).toBe(1);
    expect(state?.offsetY).toBeCloseTo(0, 5);
  });

  it('is partially faded and drifted upward mid-lifetime', () => {
    const state = gatherVfxFloatState(550);

    expect(state?.alpha).toBeCloseTo(0.5, 5);
    expect(state?.offsetY).toBeCloseTo(-20, 5);
  });

  it('returns undefined once the lifetime has fully elapsed', () => {
    expect(gatherVfxFloatState(1100)).toBeUndefined();
    expect(gatherVfxFloatState(5000)).toBeUndefined();
  });

  it('holds full opacity through the hold fraction, then fades', () => {
    expect(gatherVfxFloatState(500, 1000, 0.5)?.alpha).toBe(1);
    expect(gatherVfxFloatState(750, 1000, 0.5)?.alpha).toBeCloseTo(0.5, 5);
    expect(gatherVfxFloatState(1000, 1000, 0.5)).toBeUndefined();
  });
});
