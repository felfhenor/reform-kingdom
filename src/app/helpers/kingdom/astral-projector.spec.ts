import type * as MaterialsModule from '@helpers/item/materials';
import type {
  AstralProjectorContent,
  AstralProjectorId,
  CollectibleId,
  GameState,
  GlobalEffectId,
  ItemId,
} from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/item/collectibles', () => ({
  isCollectibleDiscovered: vi.fn(),
}));

vi.mock('@helpers/combat/combat-log', () => ({
  miscellaneousMessageLog: vi.fn(),
}));

vi.mock('@helpers/content', () => ({
  getEntriesByType: vi.fn(),
  getEntry: vi.fn(),
}));

vi.mock('@helpers/hero/global-effects', () => ({
  applyGlobalEffectAdd: vi.fn(),
  applyGlobalEffectRemove: vi.fn(),
}));

vi.mock('@helpers/item/materials', async () => {
  const actual =
    await vi.importActual<typeof MaterialsModule>('@helpers/item/materials');
  return {
    ...actual,
    getMaterialQuantity: vi.fn(),
    isMaterialDiscovered: vi.fn(),
  };
});

vi.mock('@helpers/engine/notify', () => ({
  notifySuccess: vi.fn(),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

vi.mock('@helpers/engine/timer', () => ({
  timerTicksElapsed: vi.fn(),
}));

import { miscellaneousMessageLog } from '@helpers/combat/combat-log';
import { getEntriesByType, getEntry } from '@helpers/content';
import { notifySuccess } from '@helpers/engine/notify';
import { timerTicksElapsed } from '@helpers/engine/timer';
import {
  applyGlobalEffectAdd,
  applyGlobalEffectRemove,
} from '@helpers/hero/global-effects';
import { isCollectibleDiscovered } from '@helpers/item/collectibles';
import {
  getMaterialQuantity,
  isMaterialDiscovered,
} from '@helpers/item/materials';
import {
  astralProjectorCast,
  astralProjectorMaterialEntries,
  astralProjectorProcessTick,
  astralProjectorSpellToBeOverwritten,
  isAstralProjectorCastable,
  isAstralProjectorCollectiblesMet,
  pruneInvalidActiveAstralProjectorSpells,
  pruneInvalidDiscoveredAstralProjectorSpells,
  unlockedAstralProjectorEntries,
} from '@helpers/kingdom/astral-projector';
import { gamestate, updateGamestate } from '@helpers/state-game';

describe('Astral Projector Helper Functions', () => {
  const spellId = 'spell-1' as AstralProjectorId;
  const otherSpellId = 'spell-2' as AstralProjectorId;
  const effectId = 'effect-1' as GlobalEffectId;
  const otherEffectId = 'effect-2' as GlobalEffectId;
  const collectibleId = 'collectible-1' as CollectibleId;
  const itemId = 'item-1' as ItemId;

  const spellContent: AstralProjectorContent = {
    id: spellId,
    name: 'Test Spell',
    __type: 'astralprojector',
    globalEffectId: effectId,
    duration: 60,
    requiredCollectibles: [{ collectibleId }],
    requiredMaterials: [{ itemId, quantity: 5 }],
  };

  const otherSpellContent: AstralProjectorContent = {
    id: otherSpellId,
    name: 'Other Spell',
    __type: 'astralprojector',
    globalEffectId: otherEffectId,
    duration: 30,
    requiredCollectibles: [],
    requiredMaterials: [],
  };

  function mockGetEntry(...entries: AstralProjectorContent[]): void {
    vi.mocked(getEntry).mockImplementation(
      (idOrName) =>
        entries.find(
          (entry) => entry.id === idOrName || entry.name === idOrName,
        ) as never,
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isAstralProjectorCollectiblesMet', () => {
    it('is true when every required collectible has been discovered', () => {
      vi.mocked(isCollectibleDiscovered).mockReturnValue(true);
      expect(isAstralProjectorCollectiblesMet(spellContent)).toBe(true);
    });

    it('is false when any required collectible has not been discovered', () => {
      vi.mocked(isCollectibleDiscovered).mockReturnValue(false);
      expect(isAstralProjectorCollectiblesMet(spellContent)).toBe(false);
    });

    it('is vacuously true for a spell with no required collectibles', () => {
      expect(isAstralProjectorCollectiblesMet(otherSpellContent)).toBe(true);
      expect(isCollectibleDiscovered).not.toHaveBeenCalled();
    });
  });

  describe('unlockedAstralProjectorEntries', () => {
    it('returns only entries whose required collectibles have all been discovered', () => {
      vi.mocked(getEntriesByType).mockReturnValue([
        spellContent,
        otherSpellContent,
      ]);
      vi.mocked(isCollectibleDiscovered).mockReturnValue(false);

      expect(unlockedAstralProjectorEntries()).toEqual([otherSpellContent]);
    });
  });

  describe('astralProjectorMaterialEntries', () => {
    it('resolves owned quantity and discovery state per required material', () => {
      vi.mocked(getEntry).mockReturnValue(undefined);
      vi.mocked(getMaterialQuantity).mockReturnValue(3);
      vi.mocked(isMaterialDiscovered).mockReturnValue(false);

      const entries = astralProjectorMaterialEntries(spellContent);

      expect(entries).toEqual([
        { content: undefined, quantity: 5, owned: 3, discovered: false },
      ]);
    });
  });

  describe('isAstralProjectorCastable', () => {
    it('is false when the spell is not unlocked', () => {
      vi.mocked(isCollectibleDiscovered).mockReturnValue(false);
      vi.mocked(getMaterialQuantity).mockReturnValue(999);

      expect(isAstralProjectorCastable(spellContent)).toBe(false);
    });

    it('is false when a required material is not sufficiently stocked', () => {
      vi.mocked(isCollectibleDiscovered).mockReturnValue(true);
      vi.mocked(getMaterialQuantity).mockReturnValue(4);

      expect(isAstralProjectorCastable(spellContent)).toBe(false);
    });

    it('is true when unlocked and every required material is sufficiently stocked', () => {
      vi.mocked(isCollectibleDiscovered).mockReturnValue(true);
      vi.mocked(getMaterialQuantity).mockReturnValue(5);

      expect(isAstralProjectorCastable(spellContent)).toBe(true);
    });
  });

  describe('astralProjectorSpellToBeOverwritten', () => {
    it('returns undefined when there is room for another active spell', () => {
      vi.mocked(gamestate).mockReturnValue({
        activeAstralProjectorSpells: [],
      } as unknown as GameState);

      expect(astralProjectorSpellToBeOverwritten(spellId)).toBeUndefined();
    });

    it('returns undefined when the only active spell is the one being recast', () => {
      vi.mocked(gamestate).mockReturnValue({
        activeAstralProjectorSpells: [
          { astralProjectorId: spellId, startedAtTick: 0, expiresAtTick: 60 },
        ],
      } as unknown as GameState);

      expect(astralProjectorSpellToBeOverwritten(spellId)).toBeUndefined();
    });

    it('returns the active spell that would be evicted when casting a different one at the cap', () => {
      vi.mocked(gamestate).mockReturnValue({
        activeAstralProjectorSpells: [
          { astralProjectorId: spellId, startedAtTick: 0, expiresAtTick: 60 },
        ],
      } as unknown as GameState);
      mockGetEntry(spellContent);

      expect(astralProjectorSpellToBeOverwritten(otherSpellId)).toEqual(
        spellContent,
      );
    });
  });

  describe('astralProjectorCast', () => {
    it('does nothing when the spell is not castable', () => {
      vi.mocked(isCollectibleDiscovered).mockReturnValue(false);
      mockGetEntry(spellContent);

      astralProjectorCast(spellId);

      expect(updateGamestate).not.toHaveBeenCalled();
    });

    it('deducts materials, refreshes the global effect, and pushes a new active entry when there is room', () => {
      vi.mocked(isCollectibleDiscovered).mockReturnValue(true);
      vi.mocked(getMaterialQuantity).mockReturnValue(10);
      mockGetEntry(spellContent);
      vi.mocked(gamestate).mockReturnValue({
        activeAstralProjectorSpells: [],
      } as unknown as GameState);
      vi.mocked(timerTicksElapsed).mockReturnValue(100);

      astralProjectorCast(spellId);

      expect(miscellaneousMessageLog).toHaveBeenCalledWith(
        '**Test Spell** has been cast.',
      );
      expect(miscellaneousMessageLog).toHaveBeenCalledTimes(1);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        materials: { [itemId]: { quantity: 10, foundAt: 0 } },
        discoveredMaterials: { [itemId]: { foundAt: 0 } },
        activeAstralProjectorSpells: [],
      } as unknown as GameState);

      expect(result.materials[itemId].quantity).toBe(5);
      expect(result.activeAstralProjectorSpells).toEqual([
        { astralProjectorId: spellId, startedAtTick: 100, expiresAtTick: 160 },
      ]);

      // Remove-then-add runs even though it wasn't previously active - a no-op that dedupes a recast.
      expect(applyGlobalEffectRemove).toHaveBeenCalledWith(
        expect.anything(),
        effectId,
      );
      expect(applyGlobalEffectAdd).toHaveBeenCalledWith(
        expect.anything(),
        effectId,
        60,
        100,
      );
    });

    it('evicts a different active spell at the cap, removing its effect and logging the overwrite', () => {
      vi.mocked(isCollectibleDiscovered).mockReturnValue(true);
      vi.mocked(getMaterialQuantity).mockReturnValue(0);
      mockGetEntry(spellContent, otherSpellContent);
      // "Test Spell" (spellId) is currently active; casting "Other Spell"
      // (otherSpellId, no requirements) should evict it.
      vi.mocked(gamestate).mockReturnValue({
        activeAstralProjectorSpells: [
          { astralProjectorId: spellId, startedAtTick: 0, expiresAtTick: 60 },
        ],
      } as unknown as GameState);
      vi.mocked(timerTicksElapsed).mockReturnValue(100);

      astralProjectorCast(otherSpellId);

      expect(miscellaneousMessageLog).toHaveBeenCalledWith(
        '**Test Spell** has faded, overwritten by **Other Spell**.',
      );
      expect(miscellaneousMessageLog).toHaveBeenCalledWith(
        '**Other Spell** has been cast.',
      );

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        materials: {},
        discoveredMaterials: {},
        activeAstralProjectorSpells: [
          { astralProjectorId: spellId, startedAtTick: 0, expiresAtTick: 60 },
        ],
      } as unknown as GameState);

      expect(result.activeAstralProjectorSpells).toEqual([
        {
          astralProjectorId: otherSpellId,
          startedAtTick: 100,
          expiresAtTick: 130,
        },
      ]);
      expect(applyGlobalEffectRemove).toHaveBeenCalledWith(
        expect.anything(),
        effectId,
      );
      expect(applyGlobalEffectRemove).toHaveBeenCalledWith(
        expect.anything(),
        otherEffectId,
      );
    });

    it('refreshes a same-spell recast in place rather than pushing a duplicate entry', () => {
      vi.mocked(isCollectibleDiscovered).mockReturnValue(true);
      vi.mocked(getMaterialQuantity).mockReturnValue(10);
      mockGetEntry(spellContent);
      vi.mocked(gamestate).mockReturnValue({
        activeAstralProjectorSpells: [
          { astralProjectorId: spellId, startedAtTick: 0, expiresAtTick: 60 },
        ],
      } as unknown as GameState);
      vi.mocked(timerTicksElapsed).mockReturnValue(100);

      astralProjectorCast(spellId);

      // A same-spell recast is a refresh, not an overwrite - no eviction message.
      expect(miscellaneousMessageLog).toHaveBeenCalledTimes(1);
      expect(miscellaneousMessageLog).toHaveBeenCalledWith(
        '**Test Spell** has been cast.',
      );

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        materials: { [itemId]: { quantity: 10, foundAt: 0 } },
        discoveredMaterials: { [itemId]: { foundAt: 0 } },
        activeAstralProjectorSpells: [
          { astralProjectorId: spellId, startedAtTick: 0, expiresAtTick: 60 },
        ],
      } as unknown as GameState);

      expect(result.activeAstralProjectorSpells).toEqual([
        { astralProjectorId: spellId, startedAtTick: 0, expiresAtTick: 160 },
      ]);
    });
  });

  describe('astralProjectorProcessTick', () => {
    it('unlocks a newly-collectible-gated spell, notifying and logging exactly once', () => {
      vi.mocked(getEntriesByType).mockReturnValue([spellContent]);
      vi.mocked(isCollectibleDiscovered).mockReturnValue(true);
      vi.mocked(gamestate).mockReturnValue({
        discoveredAstralProjectorSpells: {},
        activeAstralProjectorSpells: [],
      } as unknown as GameState);
      vi.mocked(timerTicksElapsed).mockReturnValue(0);

      astralProjectorProcessTick();

      expect(notifySuccess).toHaveBeenCalledWith(
        'New Astral Projector spell unlocked: Test Spell',
      );
      expect(miscellaneousMessageLog).toHaveBeenCalledWith(
        'A new Astral Projector spell has been unlocked: **Test Spell**.',
      );

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        discoveredAstralProjectorSpells: {},
      } as unknown as GameState);
      expect(result.discoveredAstralProjectorSpells[spellId]).toBeDefined();
    });

    it('does not re-notify a spell that is already in the discovered ledger', () => {
      vi.mocked(getEntriesByType).mockReturnValue([spellContent]);
      vi.mocked(isCollectibleDiscovered).mockReturnValue(true);
      vi.mocked(gamestate).mockReturnValue({
        discoveredAstralProjectorSpells: { [spellId]: { foundAt: 0 } },
        activeAstralProjectorSpells: [],
      } as unknown as GameState);
      vi.mocked(timerTicksElapsed).mockReturnValue(0);

      astralProjectorProcessTick();

      expect(notifySuccess).not.toHaveBeenCalled();
      expect(updateGamestate).not.toHaveBeenCalled();
    });

    it('expires an active spell past its expiresAtTick and logs a fade message', () => {
      vi.mocked(getEntriesByType).mockReturnValue([]);
      mockGetEntry(spellContent);
      vi.mocked(gamestate).mockReturnValue({
        discoveredAstralProjectorSpells: {},
        activeAstralProjectorSpells: [
          { astralProjectorId: spellId, startedAtTick: 0, expiresAtTick: 60 },
        ],
      } as unknown as GameState);
      vi.mocked(timerTicksElapsed).mockReturnValue(60);

      astralProjectorProcessTick();

      expect(miscellaneousMessageLog).toHaveBeenCalledWith(
        '**Test Spell** has faded.',
      );

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        activeAstralProjectorSpells: [
          { astralProjectorId: spellId, startedAtTick: 0, expiresAtTick: 60 },
        ],
      } as unknown as GameState);
      expect(result.activeAstralProjectorSpells).toHaveLength(0);
    });

    it('leaves an active spell alone before it expires', () => {
      vi.mocked(getEntriesByType).mockReturnValue([]);
      vi.mocked(gamestate).mockReturnValue({
        discoveredAstralProjectorSpells: {},
        activeAstralProjectorSpells: [
          { astralProjectorId: spellId, startedAtTick: 0, expiresAtTick: 60 },
        ],
      } as unknown as GameState);
      vi.mocked(timerTicksElapsed).mockReturnValue(30);

      astralProjectorProcessTick();

      expect(updateGamestate).not.toHaveBeenCalled();
      expect(miscellaneousMessageLog).not.toHaveBeenCalled();
    });
  });

  describe('pruneInvalidDiscoveredAstralProjectorSpells', () => {
    it('drops entries whose id no longer resolves to content', () => {
      mockGetEntry(spellContent);

      const result = pruneInvalidDiscoveredAstralProjectorSpells({
        [spellId]: { foundAt: 1 },
        [otherSpellId]: { foundAt: 2 },
      });

      expect(result).toEqual({ [spellId]: { foundAt: 1 } });
    });
  });

  describe('pruneInvalidActiveAstralProjectorSpells', () => {
    it('drops entries whose id no longer resolves to content', () => {
      mockGetEntry(spellContent);

      const result = pruneInvalidActiveAstralProjectorSpells([
        { astralProjectorId: spellId, startedAtTick: 0, expiresAtTick: 60 },
        {
          astralProjectorId: otherSpellId,
          startedAtTick: 0,
          expiresAtTick: 60,
        },
      ]);

      expect(result).toEqual([
        { astralProjectorId: spellId, startedAtTick: 0, expiresAtTick: 60 },
      ]);
    });
  });
});
