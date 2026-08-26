import type {
  CollectibleContent,
  CollectibleId,
  CollectibleSource,
  EncounterContent,
  EncounterId,
  MuseumCollectibleEntry,
  MuseumRecipeEntry,
  RecipeContent,
  RecipeId,
} from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/item/collectibles', () => ({
  getCollectibleQuantity: vi.fn(),
  isCollectibleDiscovered: vi.fn(),
}));

vi.mock('@helpers/item/collectible-source', () => ({
  getCollectibleSource: vi.fn(),
}));

vi.mock('@helpers/content', () => ({
  getEntriesByType: vi.fn(),
}));

vi.mock('@helpers/crafting/recipes', () => ({
  isRecipeDiscovered: vi.fn(),
  isRecipeDropGated: vi.fn(),
}));

vi.mock('@helpers/world-node/world-nodes', () => ({
  worldNodeDisplayName: vi.fn((nodeName: string) => nodeName),
}));

import { getEntriesByType } from '@helpers/content';
import {
  isRecipeDiscovered,
  isRecipeDropGated,
} from '@helpers/crafting/recipes';
import { getCollectibleSource } from '@helpers/item/collectible-source';
import {
  getCollectibleQuantity,
  isCollectibleDiscovered,
} from '@helpers/item/collectibles';
import {
  filterMuseumCollectibleEntries,
  filterMuseumRecipeEntries,
  getMuseumCollectibleEntries,
  getMuseumRecipeEntries,
  recipeSourceNodeNames,
} from '@helpers/kingdom/museum';
import { worldNodeDisplayName } from '@helpers/world-node/world-nodes';

const foundingStone: CollectibleContent = {
  id: 'founding-stone' as CollectibleId,
  name: 'Founding Stone',
  __type: 'collectible',
  description: 'A stone that was used to found the kingdom.',
  sprite: '0000',
  rarity: 'Legendary',
};

const goblinRuby: CollectibleContent = {
  id: 'goblin-ruby' as CollectibleId,
  name: 'Goblin Ruby',
  __type: 'collectible',
  description: 'A ruby pried from a goblin hoard.',
  sprite: '0001',
  rarity: 'Uncommon',
};

const boneHewnCloakRecipe: RecipeContent = {
  id: 'equipment-bone-hewn-cloak' as RecipeId,
  name: 'Equipment: Bone-Hewn Cloak',
  __type: 'recipe',
  result: { equipmentId: 'bone-hewn-cloak' as never },
  requirements: [],
  tradeskillId: 'tailoring-id' as never,
  minTradeskillLevel: 2,
  maxTradeskillLevel: 5,
  tradeskillXP: 1,
  craftTime: 60,
  tokenUnlockCost: 3,
};

const copperIngotRecipe: RecipeContent = {
  id: 'material-copper-ingot' as RecipeId,
  name: 'Material: Copper Ingot',
  __type: 'recipe',
  result: { itemId: 'copper-ingot' as never, quantity: 1 },
  requirements: [],
  tradeskillId: 'blacksmithing-id' as never,
  minTradeskillLevel: 1,
  maxTradeskillLevel: 3,
  tradeskillXP: 1,
  craftTime: 60,
  tokenUnlockCost: 3,
};

const fieldRuinsEncounter: EncounterContent = {
  id: 'field-ruins' as EncounterId,
  name: 'Field Ruins',
  __type: 'encounter',
  description: 'A ruined field.',
  levelRange: { min: 1, max: 5 },
  fights: [],
  completionRewards: [
    { kind: 'Collectible', collectibleId: goblinRuby.id, chance: 0.1 },
    { kind: 'Recipe', recipeId: boneHewnCloakRecipe.id, chance: 0.25 },
  ],
};

describe('Museum Helper Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getMuseumCollectibleEntries', () => {
    it('builds an entry for every collectible, discovered or not', () => {
      vi.mocked(getEntriesByType).mockImplementation(
        (type) =>
          (type === 'collectible' ? [foundingStone, goblinRuby] : []) as never,
      );
      vi.mocked(isCollectibleDiscovered).mockImplementation(
        (id) => id === foundingStone.id,
      );
      vi.mocked(getCollectibleQuantity).mockImplementation((id) =>
        id === foundingStone.id ? 1 : 0,
      );
      vi.mocked(getCollectibleSource).mockImplementation((id) =>
        id === goblinRuby.id
          ? { type: 'node', name: 'Field Ruins' }
          : undefined,
      );

      const entries = getMuseumCollectibleEntries();

      expect(entries).toEqual([
        {
          collectible: foundingStone,
          discovered: true,
          quantity: 1,
          source: undefined,
        },
        {
          collectible: goblinRuby,
          discovered: false,
          quantity: 0,
          source: { type: 'node', name: 'Field Ruins' },
        },
      ]);
    });

    it('re-masks a node source name through worldNodeDisplayName', () => {
      vi.mocked(getEntriesByType).mockImplementation(
        (type) => (type === 'collectible' ? [goblinRuby] : []) as never,
      );
      vi.mocked(isCollectibleDiscovered).mockReturnValue(false);
      vi.mocked(getCollectibleQuantity).mockReturnValue(0);
      vi.mocked(getCollectibleSource).mockReturnValue({
        type: 'node',
        name: 'Hidden Shrine',
      });
      vi.mocked(worldNodeDisplayName).mockReturnValueOnce('???');

      const entries = getMuseumCollectibleEntries();

      expect(entries[0].source).toEqual({ type: 'node', name: '???' });
    });

    it('passes crafting and trader sources through unchanged', () => {
      vi.mocked(getEntriesByType).mockImplementation(
        (type) => (type === 'collectible' ? [goblinRuby] : []) as never,
      );
      vi.mocked(isCollectibleDiscovered).mockReturnValue(false);
      vi.mocked(getCollectibleQuantity).mockReturnValue(0);
      vi.mocked(getCollectibleSource).mockReturnValue({ type: 'crafting' });

      expect(getMuseumCollectibleEntries()[0].source).toEqual({
        type: 'crafting',
      });
    });
  });

  describe('filterMuseumCollectibleEntries', () => {
    const nodeSource: CollectibleSource = { type: 'node', name: 'Field Ruins' };
    const traderSource: CollectibleSource = {
      type: 'trader',
      name: 'Juke Itos',
    };

    const discoveredEntry: MuseumCollectibleEntry = {
      collectible: foundingStone,
      discovered: true,
      quantity: 1,
      source: nodeSource,
    };

    const undiscoveredEntry: MuseumCollectibleEntry = {
      collectible: goblinRuby,
      discovered: false,
      quantity: 0,
      source: traderSource,
    };

    const entries = [discoveredEntry, undiscoveredEntry];

    it('returns every entry when the search text is empty', () => {
      expect(filterMuseumCollectibleEntries(entries, '   ')).toEqual(entries);
    });

    it('filters discovered entries by name, description, or source', () => {
      expect(filterMuseumCollectibleEntries(entries, 'founding')).toEqual([
        discoveredEntry,
      ]);
      expect(filterMuseumCollectibleEntries(entries, 'field ruins')).toEqual([
        discoveredEntry,
      ]);
    });

    it('filters undiscovered entries only by their source', () => {
      expect(filterMuseumCollectibleEntries(entries, 'juke')).toEqual([
        undiscoveredEntry,
      ]);
      expect(filterMuseumCollectibleEntries(entries, 'goblin ruby')).toEqual(
        [],
      );
    });

    it('matches a crafting source by the word "crafting"', () => {
      const craftedEntry: MuseumCollectibleEntry = {
        collectible: goblinRuby,
        discovered: false,
        quantity: 0,
        source: { type: 'crafting' },
      };

      expect(
        filterMuseumCollectibleEntries([craftedEntry], 'crafting'),
      ).toEqual([craftedEntry]);
    });

    it('treats an entry with no known source as unmatchable when undiscovered', () => {
      const unknownEntry: MuseumCollectibleEntry = {
        collectible: goblinRuby,
        discovered: false,
        quantity: 0,
      };

      expect(filterMuseumCollectibleEntries([unknownEntry], 'goblin')).toEqual(
        [],
      );
    });

    it('returns an empty array when nothing matches', () => {
      expect(filterMuseumCollectibleEntries(entries, 'nonexistent')).toEqual(
        [],
      );
    });
  });

  describe('recipeSourceNodeNames', () => {
    it('returns the names of encounters that can drop the recipe', () => {
      vi.mocked(getEntriesByType).mockReturnValue([fieldRuinsEncounter]);

      expect(recipeSourceNodeNames(boneHewnCloakRecipe.id)).toEqual([
        'Field Ruins',
      ]);
    });

    it('excludes encounters whose rewards do not include the recipe', () => {
      vi.mocked(getEntriesByType).mockReturnValue([fieldRuinsEncounter]);

      expect(recipeSourceNodeNames(copperIngotRecipe.id)).toEqual([]);
    });
  });

  describe('getMuseumRecipeEntries', () => {
    it('includes an undiscovered drop-gated recipe with its source encounter names', () => {
      vi.mocked(getEntriesByType).mockImplementation(
        (type) =>
          (type === 'recipe'
            ? [copperIngotRecipe, boneHewnCloakRecipe]
            : [fieldRuinsEncounter]) as never,
      );
      vi.mocked(isRecipeDropGated).mockImplementation(
        (id) => id === boneHewnCloakRecipe.id,
      );
      vi.mocked(isRecipeDiscovered).mockReturnValue(false);

      const entries = getMuseumRecipeEntries();

      expect(entries).toEqual([
        {
          recipe: boneHewnCloakRecipe,
          discovered: false,
          sourceNodeNames: ['Field Ruins'],
          tokenUnlockCost: boneHewnCloakRecipe.tokenUnlockCost,
        },
      ]);
    });

    it('excludes recipes that are only learned via tradeskill leveling, even if marked discovered', () => {
      vi.mocked(getEntriesByType).mockImplementation(
        (type) => (type === 'recipe' ? [copperIngotRecipe] : []) as never,
      );
      vi.mocked(isRecipeDropGated).mockReturnValue(false);
      vi.mocked(isRecipeDiscovered).mockReturnValue(true);

      expect(getMuseumRecipeEntries()).toEqual([]);
    });

    // Guards against relying on stale stored discovery state.
    it('recomputes source encounter names live even for a discovered recipe', () => {
      vi.mocked(getEntriesByType).mockImplementation(
        (type) =>
          (type === 'recipe'
            ? [boneHewnCloakRecipe]
            : [fieldRuinsEncounter]) as never,
      );
      vi.mocked(isRecipeDropGated).mockReturnValue(true);
      vi.mocked(isRecipeDiscovered).mockReturnValue(true);

      expect(getMuseumRecipeEntries()).toEqual([
        {
          recipe: boneHewnCloakRecipe,
          discovered: true,
          sourceNodeNames: ['Field Ruins'],
        },
      ]);
    });
  });

  describe('filterMuseumRecipeEntries', () => {
    const discoveredEntry: MuseumRecipeEntry = {
      recipe: boneHewnCloakRecipe,
      discovered: true,
      sourceNodeNames: ['Field Ruins'],
    };

    const undiscoveredEntry: MuseumRecipeEntry = {
      recipe: copperIngotRecipe,
      discovered: false,
      sourceNodeNames: ['Swamp'],
    };

    const entries = [discoveredEntry, undiscoveredEntry];

    it('returns every entry when the search text is empty', () => {
      expect(filterMuseumRecipeEntries(entries, '   ')).toEqual(entries);
    });

    it('filters discovered entries by name or source encounter name', () => {
      expect(filterMuseumRecipeEntries(entries, 'bone-hewn')).toEqual([
        discoveredEntry,
      ]);
      expect(filterMuseumRecipeEntries(entries, 'field ruins')).toEqual([
        discoveredEntry,
      ]);
    });

    it('filters undiscovered entries only by their source encounter names', () => {
      expect(filterMuseumRecipeEntries(entries, 'swamp')).toEqual([
        undiscoveredEntry,
      ]);
      expect(filterMuseumRecipeEntries(entries, 'copper ingot')).toEqual([]);
    });

    it('returns an empty array when nothing matches', () => {
      expect(filterMuseumRecipeEntries(entries, 'nonexistent')).toEqual([]);
    });
  });
});
