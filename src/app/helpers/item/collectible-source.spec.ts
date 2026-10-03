import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/engine/logging');

import { ensureCaravanTrader } from '@helpers/content/ensure-caravan';
import {
  ensureEncounter,
  ensureEncounterRandom,
} from '@helpers/content/ensure-encounternode';
import { ensureDroppedReward } from '@helpers/content/ensure-helpers-drops';
import { ensureRecipe } from '@helpers/content/ensure-recipe';
import { ensureTown } from '@helpers/content/ensure-town';
import { error } from '@helpers/engine/logging';
import { collectibleSourceMapBuild } from '@helpers/item/collectible-source';
import type {
  CaravanTrade,
  CaravanTraderContent,
  CaravanTraderId,
  CollectibleId,
  EncounterId,
  EncounterRandomId,
  RecipeId,
  TownId,
} from '@interfaces';
import { seedContent } from '@/testing/content';

const ruby = 'goblin-ruby' as CollectibleId;
const flower = 'gobslime-flower' as CollectibleId;
const card = 'blank-playing-card' as CollectibleId;
const effigy = 'minor-effigy' as CollectibleId;
const treasureMap = 'crude-treasure-map' as CollectibleId;
const houseModel = 'larsian-house-model' as CollectibleId;

const reward = (collectibleId: CollectibleId) =>
  ensureDroppedReward({ collectibleId, chance: 1 });

function trader(trades: Partial<CaravanTrade>[]): CaravanTraderContent {
  return ensureCaravanTrader({
    id: 'juke-itos' as CaravanTraderId,
    name: 'Juke Itos',
    trades: trades as CaravanTrade[],
    tokenTrades: [{ tokenCost: 3, collectibleId: treasureMap }],
  });
}

const allSources = [
  ensureEncounter({
    id: 'field-ruins' as EncounterId,
    name: 'Field Ruins',
    completionRewards: [reward(ruby)],
  }),
  ensureEncounterRandom({
    id: 'gobslime-shrine' as EncounterRandomId,
    name: 'Gobslime Shrine',
    completionRewards: [reward(flower)],
  }),
  ensureRecipe({
    id: 'recipe-effigy' as RecipeId,
    name: 'Recipe: Effigy',
    result: { collectibleId: effigy },
  }),
  trader([
    { type: 'sell', collectibleId: card },
    { type: 'buy', collectibleId: ruby },
  ]),
  ensureTown({
    id: 'larsia' as TownId,
    name: 'Larsia',
    defense: { rewards: [reward(houseModel)] },
  }),
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('collectibleSourceMapBuild', () => {
  it('finds each collectible’s single source across nodes, crafting, traders and raids', () => {
    seedContent(allSources);

    const sources = collectibleSourceMapBuild();

    expect(Object.fromEntries(sources)).toEqual({
      [ruby]: [{ type: 'node', name: 'Field Ruins' }],
      [flower]: [{ type: 'node', name: 'Gobslime Shrine' }],
      [effigy]: [{ type: 'crafting' }],
      [card]: [{ type: 'trader', name: 'Juke Itos' }],
      [treasureMap]: [{ type: 'trader', name: 'Juke Itos' }],
      [houseModel]: [{ type: 'raid', name: 'Larsia' }],
    });
    expect(error).not.toHaveBeenCalled();
  });

  it('flags a collectible with more than one source as a content bug', () => {
    seedContent([
      allSources[0],
      trader([{ type: 'sell', collectibleId: ruby }]),
    ]);

    expect(collectibleSourceMapBuild().get(ruby)).toEqual([
      { type: 'node', name: 'Field Ruins' },
      { type: 'trader', name: 'Juke Itos' },
    ]);
    expect(error).toHaveBeenCalledWith(
      'CollectibleSource:Collision',
      expect.stringContaining(ruby),
      expect.any(Array),
    );
  });
});
