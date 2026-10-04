import { describe, expect, it } from 'vitest';

import { ensureItem } from '@helpers/content/ensure-item';
import { ensureTown } from '@helpers/content/ensure-town';
import { defaultGameState } from '@helpers/defaults';
import { applyTownAccrueHiddenGold } from '@helpers/town/town-gold';
import type { GameState, ItemId, TownId } from '@interfaces';
import { buildTownNodeState } from '@/testing/builders';
import { seedContent } from '@/testing/content';

const goldCoin = ensureItem({ id: 'gold-coin' as ItemId, name: 'Gold Coin' });
const town = ensureTown({
  id: 'larsia' as TownId,
  materialThresholds: [{ itemId: goldCoin.id, maxQuantity: 1000 }],
});

function stateWith(hiddenGold: number): GameState {
  seedContent([goldCoin, town]);
  const state = defaultGameState();
  state.world.towns[town.id] = buildTownNodeState({ hiddenGold });
  return state;
}

const hiddenGold = (state: GameState) => state.world.towns[town.id].hiddenGold;

describe('applyTownAccrueHiddenGold', () => {
  it('adds to the town’s hidden gold up to its gold cap', () => {
    const state = stateWith(100);

    applyTownAccrueHiddenGold(state, town, town.id, 50);
    expect(hiddenGold(state)).toBe(150);

    applyTownAccrueHiddenGold(state, town, town.id, 5000);
    expect(hiddenGold(state)).toBe(1000);
  });

  it('ignores non-positive amounts and towns without state', () => {
    const state = stateWith(100);

    applyTownAccrueHiddenGold(state, town, town.id, 0);
    applyTownAccrueHiddenGold(state, town, town.id, -10);
    expect(hiddenGold(state)).toBe(100);

    const fresh = defaultGameState();
    applyTownAccrueHiddenGold(fresh, town, town.id, 50);
    expect(fresh.world.towns[town.id]).toBeUndefined();
  });
});
