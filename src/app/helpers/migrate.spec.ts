import type { EquipmentId, GameState, MaterialId } from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/armory', () => ({
  pruneInvalidArmoryItems: vi.fn((armory) => armory),
}));

vi.mock('@helpers/materials', () => ({
  pruneInvalidMaterials: vi.fn((materials) => materials),
}));

vi.mock('@helpers/defaults', () => ({
  defaultGameState: vi.fn(() => ({
    armory: [],
    materials: {},
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

import { pruneInvalidArmoryItems } from '@helpers/armory';
import { pruneInvalidMaterials } from '@helpers/materials';
import { migrateGameState } from '@helpers/migrate';
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
});
