import type {
  Character,
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

vi.mock('@helpers/bestiary', () => ({
  pruneInvalidBestiaryEntries: vi.fn((bestiary) => bestiary),
  repairInvalidBestiaryLevels: vi.fn((bestiary) => bestiary),
}));

vi.mock('@helpers/collectibles', () => ({
  grantFoundingStoneIfMissing: vi.fn((collectibles) => collectibles),
  pruneInvalidCollectibles: vi.fn((collectibles) => collectibles),
}));

vi.mock('@helpers/character-progress', () => ({
  retrofitPartyXp: vi.fn((party) => party),
}));

vi.mock('@helpers/crafting', () => ({
  pruneInvalidCraftQueues: vi.fn((tradeskills) => tradeskills),
}));

vi.mock('@helpers/equipment', () => ({
  backfillEquipmentItem: vi.fn((item) => item),
  backfillEquipmentBlock: vi.fn((equipment) => equipment),
}));

vi.mock('@helpers/materials', () => ({
  pruneInvalidMaterials: vi.fn((materials) => materials),
}));

vi.mock('@helpers/pathfinding', () => ({
  repairUnwalkableCurrentLocation: vi.fn((location) => location),
}));

vi.mock('@helpers/party', () => ({
  pruneInvalidPartyEquipment: vi.fn((party) => party),
}));

vi.mock('@helpers/recipes', () => ({
  pruneInvalidDiscoveredRecipes: vi.fn((discovered) => discovered),
}));

vi.mock('@helpers/tradeskill', () => ({
  migrateTradeskillStateKeys: vi.fn((tradeskills) => tradeskills),
  retrofitTradeskillXp: vi.fn((tradeskills) => tradeskills),
}));

vi.mock('@helpers/defaults', () => ({
  defaultGameState: vi.fn(() => ({
    armory: [],
    materials: {},
    collectibles: {},
    discoveredEquipment: {},
    discoveredRecipes: {},
    discoveredGatherNodes: {},
    worldDiscoveries: {},
    bestiary: {},
    world: { party: [] },
  })),
}));

vi.mock('@helpers/gather-node-discovery', () => ({
  pruneInvalidGatherNodeDiscoveries: vi.fn((discovered) => discovered),
  grandfatherGatherNodeDiscoveries: vi.fn(() => ({})),
}));

vi.mock('@helpers/world-nodes', () => ({
  worldNodeByName: vi.fn(),
  worldNodesOfType: vi.fn(() => []),
}));

vi.mock('@helpers/world-node-discovery', () => ({
  pruneInvalidWorldDiscoveries: vi.fn((discovered) => discovered),
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
import { retrofitPartyXp } from '@helpers/character-progress';
import {
  grantFoundingStoneIfMissing,
  pruneInvalidCollectibles,
} from '@helpers/collectibles';
import { grandfatherGatherNodeDiscoveries } from '@helpers/gather-node-discovery';
import { pruneInvalidMaterials } from '@helpers/materials';
import { migrateGameState } from '@helpers/migrate';
import { repairUnwalkableCurrentLocation } from '@helpers/pathfinding';
import { pruneInvalidPartyEquipment } from '@helpers/party';
import { pruneInvalidDiscoveredRecipes } from '@helpers/recipes';
import { gamestate, saveGameState, setGameState } from '@helpers/state-game';
import {
  migrateTradeskillStateKeys,
  retrofitTradeskillXp,
} from '@helpers/tradeskill';
import { worldNodesOfType } from '@helpers/world-nodes';
import type { WorldNodeEntry } from '@interfaces';

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
      world: { party: [] },
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
      world: { party: [] },
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

  it('prunes invalid equipment off party members before committing the migrated state', () => {
    const staleParty = [{ id: 'jala', combatOrders: {} } as Character];

    vi.mocked(gamestate).mockReturnValue({
      armory: [],
      materials: {},
      collectibles: {},
      discoveredEquipment: {},
      discoveredRecipes: {},
      world: { party: staleParty },
    } as unknown as GameState);

    const prunedParty = [{ id: 'jala', equipment: {} } as unknown as Character];
    vi.mocked(pruneInvalidPartyEquipment).mockReturnValue(prunedParty);

    migrateGameState();

    expect(pruneInvalidPartyEquipment).toHaveBeenCalledWith(staleParty);

    const committed = vi.mocked(setGameState).mock.calls[0][0];
    expect(committed.world.party).toEqual(prunedParty);
  });

  it('retrofits party and tradeskill xp to the current curve before committing', () => {
    // Reassert identity impl - vi.clearAllMocks() doesn't clear an earlier test's mockReturnValue.
    vi.mocked(pruneInvalidPartyEquipment).mockImplementation(
      (party) => party,
    );

    const staleParty = [{ id: 'jala', combatOrders: {} } as Character];
    const staleTradeskills = { Blacksmithing: { level: 1 } };

    vi.mocked(gamestate).mockReturnValue({
      armory: [],
      materials: {},
      collectibles: {},
      discoveredEquipment: {},
      discoveredRecipes: {},
      world: { party: staleParty },
      tradeskills: staleTradeskills,
    } as unknown as GameState);

    const retrofittedParty = [{ id: 'jala', xp: 'retrofitted' } as never];
    const retrofittedTradeskills = { Blacksmithing: { level: 1, xp: 'retrofitted' } };
    vi.mocked(retrofitPartyXp).mockReturnValue(retrofittedParty);
    vi.mocked(retrofitTradeskillXp).mockReturnValue(
      retrofittedTradeskills as never,
    );

    migrateGameState();

    expect(retrofitPartyXp).toHaveBeenCalledWith(staleParty);
    expect(migrateTradeskillStateKeys).toHaveBeenCalledWith(staleTradeskills);
    expect(retrofitTradeskillXp).toHaveBeenCalledWith(staleTradeskills);

    const committed = vi.mocked(setGameState).mock.calls[0][0];
    expect(committed.world.party).toEqual(retrofittedParty);
    expect(committed.tradeskills).toEqual(retrofittedTradeskills);
  });

  it('grandfathers gather-node discoveries for a save with material progress but no recorded visits', () => {
    vi.mocked(gamestate).mockReturnValue({
      armory: [],
      materials: { ['gold-coin' as MaterialId]: { quantity: 5, foundAt: 1000 } },
      collectibles: {},
      discoveredEquipment: {},
      discoveredRecipes: {},
      discoveredGatherNodes: {},
      world: { party: [] },
    } as unknown as GameState);

    const gatherNodes = [
      { nodeName: 'Wergen Woods' } as WorldNodeEntry,
      { nodeName: 'Rocky Outcrop' } as WorldNodeEntry,
    ];
    vi.mocked(worldNodesOfType).mockReturnValue(gatherNodes);

    const grandfathered = {
      'Wergen Woods': { foundAt: 5000 },
      'Rocky Outcrop': { foundAt: 5000 },
    };
    vi.mocked(grandfatherGatherNodeDiscoveries).mockReturnValue(grandfathered);

    migrateGameState();

    expect(grandfatherGatherNodeDiscoveries).toHaveBeenCalledWith([
      'Wergen Woods',
      'Rocky Outcrop',
    ]);

    const committed = vi.mocked(setGameState).mock.calls[0][0];
    expect(committed.discoveredGatherNodes).toEqual(grandfathered);
  });

  it('does not grandfather a genuinely fresh save with no materials', () => {
    // Same mock-leak caveat as the xp-retrofit test above.
    vi.mocked(pruneInvalidMaterials).mockImplementation(
      (materials) => materials,
    );

    vi.mocked(gamestate).mockReturnValue({
      armory: [],
      materials: {},
      collectibles: {},
      discoveredEquipment: {},
      discoveredRecipes: {},
      discoveredGatherNodes: {},
      world: { party: [] },
    } as unknown as GameState);

    migrateGameState();

    expect(grandfatherGatherNodeDiscoveries).not.toHaveBeenCalled();

    const committed = vi.mocked(setGameState).mock.calls[0][0];
    expect(committed.discoveredGatherNodes).toEqual({});
  });

  it('does not re-grandfather a save that already has recorded visits', () => {
    vi.mocked(gamestate).mockReturnValue({
      armory: [],
      materials: { ['gold-coin' as MaterialId]: { quantity: 5, foundAt: 1000 } },
      collectibles: {},
      discoveredEquipment: {},
      discoveredRecipes: {},
      discoveredGatherNodes: { 'Wergen Woods': { foundAt: 1000 } },
      world: { party: [] },
    } as unknown as GameState);

    migrateGameState();

    expect(grandfatherGatherNodeDiscoveries).not.toHaveBeenCalled();

    const committed = vi.mocked(setGameState).mock.calls[0][0];
    expect(committed.discoveredGatherNodes).toEqual({
      'Wergen Woods': { foundAt: 1000 },
    });
  });

  it('relocates the party off an unwalkable current location before committing', () => {
    const staleLocation = { mapName: 'Carrina', x: 1, y: 1 };

    vi.mocked(gamestate).mockReturnValue({
      armory: [],
      materials: {},
      collectibles: {},
      discoveredEquipment: {},
      discoveredRecipes: {},
      discoveredGatherNodes: {},
      world: { party: [], currentLocation: staleLocation },
    } as unknown as GameState);

    const repairedLocation = { mapName: 'Carrina', x: 26, y: 24 };
    vi.mocked(repairUnwalkableCurrentLocation).mockReturnValue(
      repairedLocation,
    );

    migrateGameState();

    expect(repairUnwalkableCurrentLocation).toHaveBeenCalledWith(
      staleLocation,
    );

    const committed = vi.mocked(setGameState).mock.calls[0][0];
    expect(committed.world.currentLocation).toEqual(repairedLocation);
  });
});
