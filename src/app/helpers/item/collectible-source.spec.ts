import type {
  CaravanTraderContent,
  CollectibleId,
  EncounterContent,
  EncounterId,
  EncounterRandomContent,
  EncounterRandomId,
  RecipeContent,
  RecipeId,
} from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content', () => ({
  getEntriesByType: vi.fn(),
}));

vi.mock('@helpers/engine/logging', () => ({
  error: vi.fn(),
}));

import { getEntriesByType } from '@helpers/content';
import { error } from '@helpers/engine/logging';
import { collectibleSourceMapBuild } from '@helpers/item/collectible-source';

const goblinRuby = 'goblin-ruby' as CollectibleId;
const gobslimeFlower = 'gobslime-flower' as CollectibleId;
const blankPlayingCard = 'blank-playing-card' as CollectibleId;
const minorEffigy = 'minor-blacksmithing-effigy' as CollectibleId;

const fieldRuinsEncounter: EncounterContent = {
  id: 'field-ruins' as EncounterId,
  name: 'Field Ruins',
  __type: 'encounter',
  description: 'A ruined field.',
  levelRange: { min: 1, max: 5 },
  fights: [],
  completionRewards: [{ collectibleId: goblinRuby, chance: 0.1 }],
};

const gobslimeShrine: EncounterRandomContent = {
  id: 'gobslime-shrine' as EncounterRandomId,
  name: 'Mystical Gobslime Shrine',
  __type: 'encounterrandom',
  description: 'A shrine.',
  resetTime: 3600,
  levelRange: { min: 15, max: 18 },
  encounterRange: { min: 2, max: 4 },
  combatantRange: { min: 4, max: 7 },
  creaturePool: [],
  fights: [],
  completionRewards: [{ collectibleId: gobslimeFlower, chance: 1 }],
};

const effigyRecipe: RecipeContent = {
  id: 'recipe-minor-effigy' as RecipeId,
  name: 'Recipe: Minor Blacksmithing Effigy',
  __type: 'recipe',
  result: { collectibleId: minorEffigy },
  requirements: [],
  tradeskillId: 'blacksmithing-id' as never,
  minTradeskillLevel: 1,
  maxTradeskillLevel: 3,
  tradeskillXP: 1,
  craftTime: 60,
};

const jukeItos: CaravanTraderContent = {
  id: 'juke-itos' as never,
  name: 'Juke Itos',
  __type: 'caravantrader',
  description: 'A trader.',
  category: 'Carrina',
  level: 3,
  trades: [
    { type: 'sell', value: 3500, collectibleId: blankPlayingCard, weight: 5 },
    { type: 'buy', value: 100, collectibleId: goblinRuby, weight: 1 },
  ],
};

function mockContent(overrides: {
  encounter?: EncounterContent[];
  encounterrandom?: EncounterRandomContent[];
  recipe?: RecipeContent[];
  caravantrader?: CaravanTraderContent[];
}) {
  vi.mocked(getEntriesByType).mockImplementation(
    (type) => (overrides[type as keyof typeof overrides] ?? []) as never,
  );
}

describe('collectibleSourceMapBuild', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('records a node source from an encounter completion reward', () => {
    mockContent({ encounter: [fieldRuinsEncounter] });

    const sources = collectibleSourceMapBuild();

    expect(sources.get(goblinRuby)).toEqual([
      { type: 'node', name: 'Field Ruins' },
    ]);
  });

  it('records a node source from an encounterrandom completion reward', () => {
    mockContent({ encounterrandom: [gobslimeShrine] });

    const sources = collectibleSourceMapBuild();

    expect(sources.get(gobslimeFlower)).toEqual([
      { type: 'node', name: 'Mystical Gobslime Shrine' },
    ]);
  });

  it('records a crafting source from a recipe result', () => {
    mockContent({ recipe: [effigyRecipe] });

    const sources = collectibleSourceMapBuild();

    expect(sources.get(minorEffigy)).toEqual([{ type: 'crafting' }]);
  });

  it('records a trader source only from sell trades, not buy trades', () => {
    mockContent({ caravantrader: [jukeItos] });

    const sources = collectibleSourceMapBuild();

    expect(sources.get(blankPlayingCard)).toEqual([
      { type: 'trader', name: 'Juke Itos' },
    ]);
    expect(sources.get(goblinRuby)).toBeUndefined();
  });

  it('leaves a collectible with no source absent from the map', () => {
    mockContent({});

    expect(
      collectibleSourceMapBuild().get('nothing' as CollectibleId),
    ).toBeUndefined();
  });

  it('logs an error when a collectible resolves to more than one source', () => {
    mockContent({
      encounter: [fieldRuinsEncounter],
      caravantrader: [
        {
          ...jukeItos,
          trades: [
            {
              type: 'sell',
              value: 1,
              collectibleId: goblinRuby,
              weight: 1,
            },
          ],
        },
      ],
    });

    const sources = collectibleSourceMapBuild();

    expect(sources.get(goblinRuby)).toEqual([
      { type: 'node', name: 'Field Ruins' },
      { type: 'trader', name: 'Juke Itos' },
    ]);
    expect(error).toHaveBeenCalledWith(
      'CollectibleSource:Collision',
      expect.stringContaining(goblinRuby),
      expect.any(Array),
    );
  });
});
