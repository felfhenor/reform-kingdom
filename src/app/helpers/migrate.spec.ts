import type {
  CollectibleId,
  EquipmentId,
  GameState,
  MaterialId,
  RecipeId,
} from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/armory', () => ({
  pruneInvalidArmoryItems: vi.fn((armory) => armory),
  pruneInvalidDiscoveredEquipment: vi.fn((discovered) => discovered),
}));

vi.mock('@helpers/collectibles', () => ({
  grantFoundingStoneIfMissing: vi.fn((collectibles) => collectibles),
  pruneInvalidCollectibles: vi.fn((collectibles) => collectibles),
}));

vi.mock('@helpers/materials', () => ({
  pruneInvalidMaterials: vi.fn((materials) => materials),
}));

vi.mock('@helpers/recipes', () => ({
  pruneInvalidDiscoveredRecipes: vi.fn((discovered) => discovered),
}));

vi.mock('@helpers/defaults', () => ({
  defaultGameState: vi.fn(() => ({
    armory: [],
    materials: {},
    collectibles: {},
    discoveredEquipment: {},
    discoveredRecipes: {},
  })),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  gamestateTickStart: vi.fn(),
  gamestateTickEnd: vi.fn(),
  saveGameState: vi.fn(),
  setGameState: vi.fn(),
}));

vi.mock('@helpers/state-options', () => ({
  defaultOptions: vi.fn(() => ({})),
  options: vi.fn(() => ({})),
  setOptions: vi.fn(),
}));

import {
  pruneInvalidArmoryItems,
  pruneInvalidDiscoveredEquipment,
} from '@helpers/armory';
import {
  grantFoundingStoneIfMissing,
  pruneInvalidCollectibles,
} from '@helpers/collectibles';
import { pruneInvalidMaterials } from '@helpers/materials';
import { migrateGameState } from '@helpers/migrate';
import { pruneInvalidDiscoveredRecipes } from '@helpers/recipes';
import { gamestate, saveGameState, setGameState } from '@helpers/state-game';

describe('migrateGameState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prunes invalid armory and material entries before committing the migrated state', () => {
    const staleArmory = [
      { equipmentId: 'sword' as EquipmentId },
      { equipmentId: 'stale-gear' as EquipmentId },
    ];
    const staleMaterials = {
      ['gold-coin' as MaterialId]: { quantity: 5, foundAt: 1000 },
      ['stale-material' as MaterialId]: { quantity: 2, foundAt: 2000 },
    };

    vi.mocked(gamestate).mockReturnValue({
      armory: staleArmory,
      materials: staleMaterials,
      collectibles: {},
      discoveredEquipment: {},
      discoveredRecipes: {},
    } as unknown as GameState);

    const prunedArmory = [{ equipmentId: 'sword' as EquipmentId }];
    const prunedMaterials = {
      ['gold-coin' as MaterialId]: { quantity: 5, foundAt: 1000 },
    };
    vi.mocked(pruneInvalidArmoryItems).mockReturnValue(prunedArmory);
    vi.mocked(pruneInvalidMaterials).mockReturnValue(prunedMaterials);

    migrateGameState();

    expect(pruneInvalidArmoryItems).toHaveBeenCalledWith(staleArmory);
    expect(pruneInvalidMaterials).toHaveBeenCalledWith(staleMaterials);

    const committed = vi.mocked(setGameState).mock.calls[0][0];
    expect(committed.armory).toEqual(prunedArmory);
    expect(committed.materials).toEqual(prunedMaterials);
    expect(saveGameState).toHaveBeenCalled();
  });

  it('prunes discovered equipment and collectibles, then grants a missing founding stone', () => {
    const staleDiscovered = {
      ['sword' as EquipmentId]: { foundAt: 1000 },
      ['stale-gear' as EquipmentId]: { foundAt: 2000 },
    };
    const staleCollectibles = {
      ['goblin-ruby' as CollectibleId]: { quantity: 1, foundAt: 1000 },
      ['stale-collectible' as CollectibleId]: { quantity: 1, foundAt: 2000 },
    };

    const staleDiscoveredRecipes = {
      ['equipment-bone-hewn-cloak' as RecipeId]: { foundAt: 1000 },
      ['stale-recipe' as RecipeId]: { foundAt: 2000 },
    };

    vi.mocked(gamestate).mockReturnValue({
      armory: [],
      materials: {},
      collectibles: staleCollectibles,
      discoveredEquipment: staleDiscovered,
      discoveredRecipes: staleDiscoveredRecipes,
    } as unknown as GameState);

    const prunedDiscovered = { ['sword' as EquipmentId]: { foundAt: 1000 } };
    const prunedCollectibles = {
      ['goblin-ruby' as CollectibleId]: { quantity: 1, foundAt: 1000 },
    };
    const collectiblesWithFoundingStone = {
      ...prunedCollectibles,
      ['founding-stone' as CollectibleId]: { quantity: 1, foundAt: 3000 },
    };

    const prunedDiscoveredRecipes = {
      ['equipment-bone-hewn-cloak' as RecipeId]: { foundAt: 1000 },
    };

    vi.mocked(pruneInvalidDiscoveredEquipment).mockReturnValue(
      prunedDiscovered,
    );
    vi.mocked(pruneInvalidCollectibles).mockReturnValue(prunedCollectibles);
    vi.mocked(grantFoundingStoneIfMissing).mockReturnValue(
      collectiblesWithFoundingStone,
    );
    vi.mocked(pruneInvalidDiscoveredRecipes).mockReturnValue(
      prunedDiscoveredRecipes,
    );

    migrateGameState();

    expect(pruneInvalidDiscoveredEquipment).toHaveBeenCalledWith(
      staleDiscovered,
    );
    expect(pruneInvalidCollectibles).toHaveBeenCalledWith(staleCollectibles);
    expect(grantFoundingStoneIfMissing).toHaveBeenCalledWith(
      prunedCollectibles,
    );
    expect(pruneInvalidDiscoveredRecipes).toHaveBeenCalledWith(
      staleDiscoveredRecipes,
    );

    const committed = vi.mocked(setGameState).mock.calls[0][0];
    expect(committed.discoveredEquipment).toEqual(prunedDiscovered);
    expect(committed.collectibles).toEqual(collectiblesWithFoundingStone);
    expect(committed.discoveredRecipes).toEqual(prunedDiscoveredRecipes);
  });
});
