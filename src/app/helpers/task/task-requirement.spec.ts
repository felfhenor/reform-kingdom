import { beforeEach, describe, expect, it } from 'vitest';

import { setAllContentById, setAllIdsByName } from '@helpers/content/content';
import { ensureEncounter } from '@helpers/content/ensure-encounternode';
import { ensureRecipe } from '@helpers/content/ensure-recipe';
import { defaultGameState } from '@helpers/defaults';
import { taskCounterRequirementHasEvidence } from '@helpers/task/task-requirement';
import type {
  AstralProjectorId,
  CollectibleId,
  EncounterId,
  GameState,
  IsContentItem,
  ItemId,
  MonsterId,
  RecipeId,
  TradeskillId,
} from '@interfaces';

const RECIPE = 'recipe-ingot' as RecipeId;
const BLACKSMITHING = 'tradeskill-blacksmithing' as TradeskillId;
const INGOT = 'item-ingot' as ItemId;
const STICK = 'item-stick' as ItemId;
const LOTUS = 'collectible-lotus' as CollectibleId;
const FOREST_RUINS = 'encounter-forest-ruins' as EncounterId;

function withTradeskillLevel(state: GameState, level: number): GameState {
  state.tradeskills[BLACKSMITHING] = {
    level,
    xp: { current: 0, maximum: 10 },
    queue: [],
  };
  return state;
}

beforeEach(() => {
  const content: IsContentItem[] = [
    ensureEncounter({
      id: FOREST_RUINS,
      name: 'Forest Ruins',
      completionRewards: [
        {
          kind: 'Collectible',
          collectibleId: LOTUS,
          chance: 100,
          minLevel: 0,
          maxLevel: 99,
        },
      ],
    }),
    ensureRecipe({
      id: RECIPE,
      name: 'Material: Ingot',
      tradeskillId: BLACKSMITHING,
      minTradeskillLevel: 1,
      result: { itemId: INGOT },
    }),
  ];
  setAllContentById(new Map(content.map((entry) => [entry.id, entry])));
  setAllIdsByName(new Map([['Forest Ruins', FOREST_RUINS]]));
});

describe('taskCounterRequirementHasEvidence', () => {
  it('needs both the gather node and the item discovered for GatherItem', () => {
    const state = defaultGameState();
    const requirement = {
      kind: 'GatherItem' as const,
      nodeName: 'Wergen Woods',
      itemId: STICK,
      quantity: 5,
    };

    state.discoveredMaterials[STICK] = { foundAt: 1 };
    expect(taskCounterRequirementHasEvidence(state, requirement)).toBe(false);

    state.discoveredGatherNodes['Wergen Woods'] = { foundAt: 1 };
    expect(taskCounterRequirementHasEvidence(state, requirement)).toBe(true);
  });

  it('needs the result discovered and the tradeskill past the recipe minimum for CraftRecipe', () => {
    const requirement = {
      kind: 'CraftRecipe' as const,
      recipeId: RECIPE,
      quantity: 1,
    };

    const discoveredOnly = withTradeskillLevel(defaultGameState(), 1);
    discoveredOnly.discoveredMaterials[INGOT] = { foundAt: 1 };
    expect(taskCounterRequirementHasEvidence(discoveredOnly, requirement)).toBe(
      false,
    );

    const leveledOnly = withTradeskillLevel(defaultGameState(), 2);
    expect(taskCounterRequirementHasEvidence(leveledOnly, requirement)).toBe(
      false,
    );

    leveledOnly.discoveredMaterials[INGOT] = { foundAt: 1 };
    expect(taskCounterRequirementHasEvidence(leveledOnly, requirement)).toBe(
      true,
    );
  });

  it('needs a guaranteed completion reward for ClearEncounter, since kills alone may not be a clear', () => {
    const state = defaultGameState();
    const requirement = {
      kind: 'ClearEncounter' as const,
      nodeName: 'Forest Ruins',
      quantity: 1,
    };

    state.bestiary['goblin' as MonsterId] = {
      foundAt: 1,
      kills: 3,
      minLevelFound: 2,
      maxLevelFound: 3,
      foundAtNodes: ['Forest Ruins'],
    };
    expect(taskCounterRequirementHasEvidence(state, requirement)).toBe(false);

    state.collectibles[LOTUS] = { quantity: 1, foundAt: 1 };
    expect(taskCounterRequirementHasEvidence(state, requirement)).toBe(true);
  });

  it('has no ClearEncounter evidence for an unknown node', () => {
    const state = defaultGameState();

    expect(
      taskCounterRequirementHasEvidence(state, {
        kind: 'ClearEncounter',
        nodeName: 'Nowhere',
        quantity: 1,
      }),
    ).toBe(false);
  });

  it('uses a currently active spell as evidence for CastAstralSpell', () => {
    const state = defaultGameState();
    const requirement = {
      kind: 'CastAstralSpell' as const,
      astralProjectorId: 'spell-duchy' as AstralProjectorId,
      quantity: 1,
    };

    expect(taskCounterRequirementHasEvidence(state, requirement)).toBe(false);
    state.activeAstralProjectorSpells = [
      {
        astralProjectorId: 'spell-duchy' as AstralProjectorId,
        startedAtTick: 0,
        expiresAtTick: 100,
      },
    ];
    expect(taskCounterRequirementHasEvidence(state, requirement)).toBe(true);
  });
});
