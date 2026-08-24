import type {
  Character,
  CollectibleId,
  EquipmentId,
  GameState,
  MaterialId,
  RecipeId,
} from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/kingdom/armory', () => ({
  pruneInvalidArmoryItems: vi.fn((armory) => armory),
  pruneInvalidDiscoveredEquipment: vi.fn((discovered) => discovered),
}));

vi.mock('@helpers/kingdom/astral-projector', () => ({
  pruneInvalidDiscoveredAstralProjectorSpells: vi.fn(
    (discovered) => discovered,
  ),
  pruneInvalidActiveAstralProjectorSpells: vi.fn((active) => active),
}));

vi.mock('@helpers/kingdom/bestiary', () => ({
  pruneInvalidBestiaryEntries: vi.fn((bestiary) => bestiary),
  repairInvalidBestiaryLevels: vi.fn((bestiary) => bestiary),
}));

vi.mock('@helpers/item/collectibles', () => ({
  grantFoundingStoneIfMissing: vi.fn((collectibles) => collectibles),
  pruneInvalidCollectibles: vi.fn((collectibles) => collectibles),
}));

vi.mock('@helpers/hero/character-progress', () => ({
  retrofitPartyXp: vi.fn((party) => party),
}));

vi.mock('@helpers/crafting/crafting', () => ({
  pruneInvalidCraftQueues: vi.fn((tradeskills) => tradeskills),
}));

vi.mock('@helpers/decree/decree', () => ({
  backfillDecreeClauseRiskTolerance: vi.fn((clauses) => clauses),
  pruneInvalidDecreeGatherClauses: vi.fn((clauses) => clauses),
}));

vi.mock('@helpers/item/equipment', () => ({
  backfillEquipmentItem: vi.fn((item) => item),
  backfillEquipmentBlock: vi.fn((equipment) => equipment),
}));

vi.mock('@helpers/item/materials', () => ({
  pruneInvalidMaterials: vi.fn((materials) => materials),
  pruneInvalidDiscoveredMaterials: vi.fn((discovered) => discovered),
}));

vi.mock('@helpers/pathfinding/pathfinding', () => ({
  repairUnwalkableCurrentLocation: vi.fn((location) => location),
}));

vi.mock('@helpers/hero/party', () => ({
  pruneInvalidPartyEquipment: vi.fn((party) => party),
}));

vi.mock('@helpers/crafting/recipes', () => ({
  pruneInvalidDiscoveredRecipes: vi.fn((discovered) => discovered),
}));

vi.mock('@helpers/crafting/tradeskill', () => ({
  migrateTradeskillStateKeys: vi.fn((tradeskills) => tradeskills),
  retrofitTradeskillXp: vi.fn((tradeskills) => tradeskills),
}));

vi.mock('@helpers/defaults', () => ({
  defaultGameState: vi.fn(() => ({
    armory: [],
    materials: {},
    discoveredMaterials: {},
    collectibles: {},
    discoveredEquipment: {},
    discoveredRecipes: {},
    discoveredGatherNodes: {},
    worldDiscoveries: {},
    bestiary: {},
    discoveredAstralProjectorSpells: {},
    activeAstralProjectorSpells: [],
    world: { party: [], autoMode: { clauses: [] } },
  })),
}));

vi.mock('@helpers/item/gather-node-discovery', () => ({
  pruneInvalidGatherNodeDiscoveries: vi.fn((discovered) => discovered),
  grandfatherGatherNodeDiscoveries: vi.fn(() => ({})),
}));

vi.mock('@helpers/world-node/world-nodes', () => ({
  worldNodeByName: vi.fn(),
  worldNodesOfType: vi.fn(() => []),
}));

vi.mock('@helpers/world-node/world-node-discovery', () => ({
  pruneInvalidWorldDiscoveries: vi.fn((discovered) => discovered),
}));

vi.mock('@helpers/world-node/world-node-gathering', () => ({
  allGatherableMaterialIds: vi.fn(() => []),
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

import { pruneInvalidDiscoveredRecipes } from '@helpers/crafting/recipes';
import {
  migrateTradeskillStateKeys,
  retrofitTradeskillXp,
} from '@helpers/crafting/tradeskill';
import {
  backfillDecreeClauseRiskTolerance,
  pruneInvalidDecreeGatherClauses,
} from '@helpers/decree/decree';
import { retrofitPartyXp } from '@helpers/hero/character-progress';
import { pruneInvalidPartyEquipment } from '@helpers/hero/party';
import {
  grantFoundingStoneIfMissing,
  pruneInvalidCollectibles,
} from '@helpers/item/collectibles';
import { grandfatherGatherNodeDiscoveries } from '@helpers/item/gather-node-discovery';
import {
  pruneInvalidDiscoveredMaterials,
  pruneInvalidMaterials,
} from '@helpers/item/materials';
import {
  pruneInvalidArmoryItems,
  pruneInvalidDiscoveredEquipment,
} from '@helpers/kingdom/armory';
import { migrateGameState } from '@helpers/migrate';
import { repairUnwalkableCurrentLocation } from '@helpers/pathfinding/pathfinding';
import { gamestate, saveGameState, setGameState } from '@helpers/state-game';
import { allGatherableMaterialIds } from '@helpers/world-node/world-node-gathering';
import { worldNodesOfType } from '@helpers/world-node/world-nodes';
import type { DecreeClause, DecreeClauseId, WorldNodeEntry } from '@interfaces';

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
    vi.mocked(pruneInvalidPartyEquipment).mockImplementation((party) => party);

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
    const retrofittedTradeskills = {
      Blacksmithing: { level: 1, xp: 'retrofitted' },
    };
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
      materials: {
        ['gold-coin' as MaterialId]: { quantity: 5, foundAt: 1000 },
      },
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
      materials: {
        ['gold-coin' as MaterialId]: { quantity: 5, foundAt: 1000 },
      },
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

  it('prunes decree GatherMaterial clauses no GatherNode can satisfy anymore', () => {
    const staleClauses = [
      {
        id: 'clause-1' as DecreeClauseId,
        type: 'GatherMaterial',
        materialId: 'wergen-stick' as MaterialId,
        targetQuantity: 1000,
        enabled: true,
        failureCount: 0,
      } as DecreeClause,
    ];

    vi.mocked(gamestate).mockReturnValue({
      armory: [],
      materials: {},
      collectibles: {},
      discoveredEquipment: {},
      discoveredRecipes: {},
      discoveredGatherNodes: {},
      world: { party: [], autoMode: { clauses: staleClauses } },
    } as unknown as GameState);

    vi.mocked(allGatherableMaterialIds).mockReturnValue([]);
    vi.mocked(pruneInvalidDecreeGatherClauses).mockReturnValue([]);

    migrateGameState();

    expect(pruneInvalidDecreeGatherClauses).toHaveBeenCalledWith(
      staleClauses,
      [],
    );

    const committed = vi.mocked(setGameState).mock.calls[0][0];
    expect(committed.world.autoMode.clauses).toEqual([]);
  });

  it('backfills the legacy global risk tolerance onto risk-aware clauses', () => {
    const clauses = [
      {
        id: 'clause-1' as DecreeClauseId,
        type: 'LevelUpParty',
      } as DecreeClause,
    ];

    vi.mocked(gamestate).mockReturnValue({
      armory: [],
      materials: {},
      collectibles: {},
      discoveredEquipment: {},
      discoveredRecipes: {},
      discoveredGatherNodes: {},
      world: {
        party: [],
        autoMode: { clauses, riskTolerance: 'High' },
      },
    } as unknown as GameState);

    vi.mocked(pruneInvalidDecreeGatherClauses).mockReturnValue(clauses);
    const backfilled = [
      { ...clauses[0], riskTolerance: 'High' } as DecreeClause,
    ];
    vi.mocked(backfillDecreeClauseRiskTolerance).mockReturnValue(backfilled);

    migrateGameState();

    expect(backfillDecreeClauseRiskTolerance).toHaveBeenCalledWith(
      clauses,
      'High',
    );

    const committed = vi.mocked(setGameState).mock.calls[0][0];
    expect(committed.world.autoMode.clauses).toEqual(backfilled);
  });

  it('defaults the legacy risk tolerance to Medium when no save had it', () => {
    const clauses = [
      {
        id: 'clause-1' as DecreeClauseId,
        type: 'LevelUpParty',
      } as DecreeClause,
    ];

    vi.mocked(gamestate).mockReturnValue({
      armory: [],
      materials: {},
      collectibles: {},
      discoveredEquipment: {},
      discoveredRecipes: {},
      discoveredGatherNodes: {},
      world: { party: [], autoMode: { clauses } },
    } as unknown as GameState);

    vi.mocked(pruneInvalidDecreeGatherClauses).mockReturnValue(clauses);

    migrateGameState();

    expect(backfillDecreeClauseRiskTolerance).toHaveBeenCalledWith(
      clauses,
      'Medium',
    );
  });

  it('prunes stale discoveredMaterials entries and backfills from current stock', () => {
    const staleDiscovered = {
      ['gold-coin' as MaterialId]: { foundAt: 1000 },
      ['stale-material' as MaterialId]: { foundAt: 2000 },
    };
    // gold-coin's foundAt (500) deliberately differs from its current-stock foundAt (1000), so an
    // errant backfill overwrite (instead of preserving the pruned entry) would be caught below.
    const currentMaterials = {
      ['gold-coin' as MaterialId]: { quantity: 5, foundAt: 1000 },
      ['copper-ore' as MaterialId]: { quantity: 3, foundAt: 3000 },
    };

    vi.mocked(gamestate).mockReturnValue({
      armory: [],
      materials: currentMaterials,
      discoveredMaterials: staleDiscovered,
      collectibles: {},
      discoveredEquipment: {},
      discoveredRecipes: {},
      discoveredGatherNodes: {},
      world: { party: [] },
    } as unknown as GameState);

    const prunedDiscovered = { ['gold-coin' as MaterialId]: { foundAt: 500 } };
    vi.mocked(pruneInvalidMaterials).mockReturnValue(currentMaterials);
    vi.mocked(pruneInvalidDiscoveredMaterials).mockReturnValue(
      prunedDiscovered,
    );

    migrateGameState();

    expect(pruneInvalidDiscoveredMaterials).toHaveBeenCalledWith(
      staleDiscovered,
    );

    const committed = vi.mocked(setGameState).mock.calls[0][0];
    expect(committed.discoveredMaterials).toEqual({
      ['gold-coin' as MaterialId]: { foundAt: 500 },
      ['copper-ore' as MaterialId]: { foundAt: 3000 },
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

    expect(repairUnwalkableCurrentLocation).toHaveBeenCalledWith(staleLocation);

    const committed = vi.mocked(setGameState).mock.calls[0][0];
    expect(committed.world.currentLocation).toEqual(repairedLocation);
  });
});
