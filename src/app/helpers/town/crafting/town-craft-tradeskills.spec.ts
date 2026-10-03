import { describe, expect, it } from 'vitest';

import { TRADESKILL_MAX_LEVEL } from '@helpers/config';
import { ensureRecipe } from '@helpers/content/ensure-recipe';
import { ensureTown } from '@helpers/content/ensure-town';
import { ensureTradeskill } from '@helpers/content/ensure-tradeskill';
import {
  pruneInvalidTownCraftQueue,
  pruneInvalidTownTradeskills,
  townTradeskillsMaterialize,
} from '@helpers/town/crafting/town-craft-tradeskills';
import type { RecipeId, TownId, TradeskillId } from '@interfaces';
import { buildTownCraftQueueEntry } from '@/testing/builders';
import { seedContent } from '@/testing/content';

const townId = 'larsia' as TownId;
const smithing = ensureTradeskill({
  id: 'blacksmithing' as TradeskillId,
  name: 'Blacksmithing',
});
const woodworking = ensureTradeskill({
  id: 'woodworking' as TradeskillId,
  name: 'Woodworking',
});
const recipe = ensureRecipe({ id: 'ingot' as RecipeId, name: 'Ingot' });

function seedTown(levels: { tradeskillId: TradeskillId; level: number }[]) {
  seedContent([
    ensureTown({
      id: townId,
      name: 'Larsia',
      crafting: { tradeskillLevels: levels },
    }),
    smithing,
    woodworking,
    recipe,
  ]);
}

describe('townTradeskillsMaterialize', () => {
  it('syncs every tradeskill to the town’s seed level, defaulting to 1 and capping at the max', () => {
    seedTown([{ tradeskillId: smithing.id, level: 12 }]);
    expect(townTradeskillsMaterialize(townId, {})).toEqual({
      [smithing.id]: { level: 12 },
      [woodworking.id]: { level: 1 },
    });

    seedTown([{ tradeskillId: smithing.id, level: TRADESKILL_MAX_LEVEL + 1 }]);
    expect(townTradeskillsMaterialize(townId, {})[smithing.id]).toEqual({
      level: TRADESKILL_MAX_LEVEL,
    });
  });

  it('overwrites a saved level that drifted from the seed, in either direction', () => {
    seedTown([{ tradeskillId: smithing.id, level: 12 }]);

    for (const saved of [3, 40]) {
      expect(
        townTradeskillsMaterialize(townId, { [smithing.id]: { level: saved } })[
          smithing.id
        ],
      ).toEqual({ level: 12 });
    }
  });

  it('keeps saved tradeskills gone from content, leaving them to pruning', () => {
    seedTown([]);
    const removed = 'removed' as TradeskillId;

    expect(
      townTradeskillsMaterialize(townId, { [removed]: { level: 7 } })[removed],
    ).toEqual({ level: 7 });
  });

  it('leaves the saved levels alone for a town gone from content', () => {
    seedContent([smithing]);
    const existing = { [smithing.id]: { level: 5 } };

    expect(townTradeskillsMaterialize(townId, existing)).toBe(existing);
  });
});

describe('pruneInvalidTownTradeskills', () => {
  it('drops tradeskills gone from content', () => {
    seedTown([]);
    const kept = { level: 4 };

    expect(
      pruneInvalidTownTradeskills({
        [smithing.id]: kept,
        ['removed' as TradeskillId]: { level: 1 },
      }),
    ).toEqual({ [smithing.id]: kept });
  });
});

describe('pruneInvalidTownCraftQueue', () => {
  it('drops entries whose tradeskill or recipe is gone from content', () => {
    seedTown([]);
    const valid = buildTownCraftQueueEntry({
      tradeskillId: smithing.id,
      recipeId: recipe.id,
    });

    expect(
      pruneInvalidTownCraftQueue([
        valid,
        { ...valid, tradeskillId: 'removed' as TradeskillId },
        { ...valid, recipeId: 'removed' as RecipeId },
      ]),
    ).toEqual([valid]);
  });
});
