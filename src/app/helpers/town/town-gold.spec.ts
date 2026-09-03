import { describe, expect, it } from 'vitest';

import { applyTownAccrueHiddenGold } from '@helpers/town/town-gold';
import type { GameState, TownContent, TownId } from '@interfaces';

const townId = 'larsia' as TownId;

function buildTown(goldRequiredBeforeCutoff = 1000): TownContent {
  return {
    gathering: { goldRequiredBeforeCutoff },
  } as unknown as TownContent;
}

function buildState(hiddenGold: number): GameState {
  return {
    world: { towns: { [townId]: { hiddenGold } } },
  } as unknown as GameState;
}

describe('applyTownAccrueHiddenGold', () => {
  it('adds the amount to the town hiddenGold total', () => {
    const state = buildState(100);

    applyTownAccrueHiddenGold(state, buildTown(), townId, 50);

    expect(state.world.towns[townId].hiddenGold).toBe(150);
  });

  it('clamps at goldRequiredBeforeCutoff', () => {
    const state = buildState(950);

    applyTownAccrueHiddenGold(state, buildTown(1000), townId, 500);

    expect(state.world.towns[townId].hiddenGold).toBe(1000);
  });

  it('does nothing for a non-positive amount', () => {
    const state = buildState(100);

    applyTownAccrueHiddenGold(state, buildTown(), townId, 0);
    applyTownAccrueHiddenGold(state, buildTown(), townId, -10);

    expect(state.world.towns[townId].hiddenGold).toBe(100);
  });

  it('does nothing when the town has no state entry', () => {
    const state = { world: { towns: {} } } as unknown as GameState;

    expect(() =>
      applyTownAccrueHiddenGold(state, buildTown(), townId, 50),
    ).not.toThrow();
    expect(state.world.towns[townId]).toBeUndefined();
  });
});
