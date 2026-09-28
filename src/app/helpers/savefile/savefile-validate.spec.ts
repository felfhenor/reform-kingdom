import { defaultGameState } from '@helpers/defaults';
import {
  savefileIsValid,
  savefileIsWorthKeeping,
  savefileValidationErrors,
} from '@helpers/savefile/savefile-validate';
import { describe, expect, it } from 'vitest';

describe('savefileValidationErrors', () => {
  it('accepts a default game state', () => {
    expect(savefileValidationErrors(defaultGameState())).toEqual([]);
  });

  it('accepts a pre-party save whose world has no party yet', () => {
    const state = { ...defaultGameState(), world: {} };

    expect(savefileValidationErrors(state)).toEqual([]);
  });

  it.each([undefined, null, 'save', 42, []])(
    'rejects non-object %s',
    (value) => {
      expect(savefileValidationErrors(value)).toHaveLength(1);
    },
  );

  it('reports each missing core section', () => {
    const errors = savefileValidationErrors({ world: { party: {} } });

    expect(errors).toEqual([
      'Savefile metadata is missing.',
      'Game id is missing.',
      'Game clock is missing or corrupt.',
      'Party data is corrupt.',
    ]);
  });

  it('rejects a clock without a tick count', () => {
    const state = { ...defaultGameState(), clock: {} };

    expect(savefileIsValid(state)).toBe(false);
  });
});

describe('savefileIsWorthKeeping', () => {
  it('skips a valid save that was never set up', () => {
    expect(savefileIsWorthKeeping(defaultGameState())).toBe(false);
  });

  it('keeps a valid, set-up save', () => {
    const state = defaultGameState();
    state.meta.isSetup = true;

    expect(savefileIsWorthKeeping(state)).toBe(true);
  });

  it('skips an invalid save even if flagged as set up', () => {
    expect(savefileIsWorthKeeping({ meta: { isSetup: true } })).toBe(false);
  });
});
