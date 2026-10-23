import { describe, expect, it } from 'vitest';

import { ensureCaravanTrader } from '@helpers/content/ensure-caravan';
import { ensureEncounter } from '@helpers/content/ensure-encounternode';
import { ensureDroppedReward } from '@helpers/content/ensure-helpers-drops';
import { ensureTown } from '@helpers/content/ensure-town';
import {
  isCollectibleSourceKnown,
  recipeSources,
} from '@helpers/kingdom/museum';
import type {
  CaravanTraderId,
  EncounterId,
  RecipeId,
  TownId,
} from '@interfaces';
import { buildTownNodeState } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';

const cloakRecipe = 'equipment-bone-hewn-cloak' as RecipeId;
const ingotRecipe = 'material-copper-ingot' as RecipeId;
const mapRecipe = 'collectible-map' as RecipeId;

describe('recipeSources', () => {
  it('names the encounters that drop a recipe and the traders that sell it', () => {
    seedContent([
      ensureEncounter({
        id: 'field-ruins' as EncounterId,
        name: 'Field Ruins',
        completionRewards: [
          ensureDroppedReward({ recipeId: cloakRecipe, chance: 0.25 }),
        ],
      }),
      ensureCaravanTrader({
        id: 'alekia-figaro' as CaravanTraderId,
        name: 'Alekia Figaro',
        trades: [
          { type: 'sell', value: 25000, recipeId: ingotRecipe, weight: 1 },
        ],
        tokenTrades: [{ tokenCost: 3, recipeId: mapRecipe }],
      }),
    ]);

    const alekia = {
      type: 'trader',
      traderId: 'alekia-figaro',
      name: 'Alekia Figaro',
    };
    expect(recipeSources(cloakRecipe)).toEqual([
      { type: 'node', name: 'Field Ruins' },
    ]);
    expect(recipeSources(ingotRecipe)).toEqual([alekia]);
    expect(recipeSources(mapRecipe)).toEqual([alekia]);
    expect(recipeSources('unsourced' as RecipeId)).toEqual([]);
  });
});

describe('isCollectibleSourceKnown', () => {
  const traderId = 'juke-itos' as CaravanTraderId;
  const townId = 'larsia' as TownId;

  it('hides traders and towns until met or visited', () => {
    seedContent([ensureTown({ id: townId, name: 'Larsia' })]);
    seedGamestate();

    expect(
      isCollectibleSourceKnown({ type: 'trader', traderId, name: 'Juke' }),
    ).toBe(false);
    expect(
      isCollectibleSourceKnown({ type: 'raid', townId, name: 'Larsia' }),
    ).toBe(false);
    expect(isCollectibleSourceKnown({ type: 'crafting' })).toBe(true);
  });

  it('reveals traders and towns once met or visited', () => {
    seedContent([ensureTown({ id: townId, name: 'Larsia' })]);
    seedGamestate((state) => {
      state.discoveredTraders[traderId] = { foundAt: 1 };
      state.world.towns[townId] = buildTownNodeState({
        firstVisitedAtTick: 1,
      });
    });

    expect(
      isCollectibleSourceKnown({ type: 'trader', traderId, name: 'Juke' }),
    ).toBe(true);
    expect(
      isCollectibleSourceKnown({ type: 'raid', townId, name: 'Larsia' }),
    ).toBe(true);
  });
});
