import { describe, expect, it } from 'vitest';

import { ensureCollectible, ensureItem } from '@helpers/content/ensure-item';
import { collectiblesAdd } from '@helpers/item/collectibles';
import {
  applyMaterialDelta,
  applyMaterialIncome,
  gainGold,
  grantStartingGold,
  spendGold,
} from '@helpers/item/materials';
import { defaultRunStats } from '@helpers/defaults';
import {
  runStatsBackfillTracking,
  runStatsRecordFightEnd,
} from '@helpers/run-stats/run-stats';
import { gamestate, runStatsState, updateGamestate } from '@helpers/state-game';
import type { CollectibleId, GameState, ItemId } from '@interfaces';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';

const gold = ensureItem({ id: 'gold' as ItemId, name: 'Gold Coin' });
const ore = ensureItem({ id: 'ore' as ItemId, name: 'Ore' });
const memory = ensureCollectible({
  id: 'memory' as CollectibleId,
  name: 'Memory of the Forgetter',
});

function write(edit: (state: GameState) => void): void {
  inTick(() =>
    updateGamestate((state) => {
      edit(state);
      return state;
    }),
  );
}

describe('gold earned', () => {
  it('counts gold from income sites only', () => {
    seedContent([gold, ore]);
    seedGamestate();

    write((state) => {
      applyMaterialIncome(state, gold.id, 10);
      applyMaterialIncome(state, ore.id, 99);
      gainGold(state, 5);
    });
    expect(runStatsState().goldEarned).toBe(15);
  });

  it('ignores starting gold, refunds, conversions and spending', () => {
    seedContent([gold]);
    seedGamestate();

    write((state) => {
      grantStartingGold(state);
      applyMaterialDelta(state, gold.id, 40);
      spendGold(state, 20);
    });
    expect(runStatsState().goldEarned).toBe(0);
  });
});

describe('fights', () => {
  it('counts each fight as won or lost', () => {
    seedGamestate();

    inTick(() => {
      runStatsRecordFightEnd(true);
      runStatsRecordFightEnd(true);
      runStatsRecordFightEnd(false);
    });
    expect(runStatsState()).toMatchObject({ fightsWon: 2, fightsLost: 1 });
  });
});

describe('Fel defeated', () => {
  it('records the tick of the first victory only', () => {
    seedContent([memory]);
    seedGamestate((state) => {
      state.clock.numTicks = 50;
    });

    inTick(() => collectiblesAdd(memory.id));
    write((state) => {
      state.clock.numTicks = 90;
    });
    inTick(() => collectiblesAdd(memory.id));

    expect(gamestate().runStats.felDefeatedTick).toBe(50);
  });

  it('stays untracked on a save that beat Fel before stats existed', () => {
    seedContent([memory]);
    seedGamestate((state) => {
      state.collectibles[memory.id] = { quantity: 1, foundAt: 1000 };
      state.clock.numTicks = 70;
    });

    inTick(() => collectiblesAdd(memory.id));

    expect(gamestate().runStats.felDefeatedTick).toBeUndefined();
  });
});

describe('runStatsBackfillTracking', () => {
  it('marks a save from before run stats as tracked from now', () => {
    expect(
      runStatsBackfillTracking(defaultRunStats(), 500, 2).trackedFromTick,
    ).toBe(500);
    expect(
      runStatsBackfillTracking(defaultRunStats(), 500, 3).trackedFromTick,
    ).toBe(0);
  });
});
