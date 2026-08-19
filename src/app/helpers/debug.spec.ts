import type {
  CharacterId,
  Character,
  CollectibleContent,
  CollectibleId,
  EquipmentContent,
  EquipmentId,
  GameState,
  ItemContent,
  ItemId,
  StatBlock,
  TradeskillBuildingState,
  TradeskillId,
} from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/armory', () => ({
  armoryAdd: vi.fn(),
}));

vi.mock('@helpers/collectibles', () => ({
  collectiblesAdd: vi.fn(),
}));

vi.mock('@helpers/content', () => ({
  getEntriesByType: vi.fn(),
  getEntry: vi.fn(),
}));

vi.mock('@helpers/materials', () => ({
  addMaterial: vi.fn(),
}));

vi.mock('@helpers/party', () => ({
  CHARACTER_MAX_LEVEL: 99,
  characterStatsForLevel: vi.fn(),
  characterXpForLevel: vi.fn(),
}));

vi.mock('@helpers/tradeskill', () => ({
  TRADESKILL_MAX_LEVEL: 50,
  tradeskillIdForName: vi.fn(),
  tradeskillXpForLevel: vi.fn(),
}));

vi.mock('@helpers/state-game', () => ({
  updateGamestate: vi.fn(),
}));

vi.mock('@helpers/state-options', () => ({
  setOption: vi.fn(),
}));

vi.mock('@helpers/world-node-discovery', () => ({
  worldNodeDiscover: vi.fn(),
  worldNodeUndiscover: vi.fn(),
}));

import { armoryAdd } from '@helpers/armory';
import { collectiblesAdd } from '@helpers/collectibles';
import { getEntriesByType, getEntry } from '@helpers/content';
import {
  debugDiscoverWorldNode,
  debugGiveAllEquipment,
  debugGiveCollectible,
  debugGiveEquipment,
  debugGiveItem,
  debugResetBestiary,
  debugSetCharacterLevel,
  debugSetTradeskillLevel,
  debugUndiscoverWorldNode,
  debugWipeWorldDiscoveries,
} from '@helpers/debug';
import { addMaterial } from '@helpers/materials';
import { characterStatsForLevel, characterXpForLevel } from '@helpers/party';
import { updateGamestate } from '@helpers/state-game';
import { tradeskillIdForName, tradeskillXpForLevel } from '@helpers/tradeskill';
import {
  worldNodeDiscover,
  worldNodeUndiscover,
} from '@helpers/world-node-discovery';

describe('Debug Helper Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  describe('debugGiveItem', () => {
    it('adds the given quantity of the material when it resolves to real content', () => {
      vi.mocked(getEntry).mockReturnValue({ id: 'gold-coin' } as ItemContent);

      debugGiveItem('gold-coin' as ItemId, 5);

      expect(addMaterial).toHaveBeenCalledWith('gold-coin', 5);
    });

    it('does nothing for a zero or negative quantity', () => {
      debugGiveItem('gold-coin' as ItemId, 0);
      debugGiveItem('gold-coin' as ItemId, -5);

      expect(addMaterial).not.toHaveBeenCalled();
    });

    it('does nothing and warns when the item id does not resolve to real content', () => {
      vi.mocked(getEntry).mockReturnValue(undefined);

      debugGiveItem('unknown-item' as ItemId, 5);

      expect(addMaterial).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalled();
    });
  });

  describe('debugGiveEquipment', () => {
    it('adds the given quantity of the equipment to the armory when it resolves to real content', () => {
      vi.mocked(getEntry).mockReturnValue({ id: 'sword' } as EquipmentContent);

      debugGiveEquipment('sword' as EquipmentId, 3);

      expect(armoryAdd).toHaveBeenCalledWith('sword', 3);
    });

    it('does nothing for a zero or negative quantity', () => {
      debugGiveEquipment('sword' as EquipmentId, 0);
      debugGiveEquipment('sword' as EquipmentId, -1);

      expect(armoryAdd).not.toHaveBeenCalled();
    });

    it('does nothing and warns when the equipment id does not resolve to real content', () => {
      vi.mocked(getEntry).mockReturnValue(undefined);

      debugGiveEquipment('unknown-gear' as EquipmentId, 3);

      expect(armoryAdd).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalled();
    });

    it('does nothing and warns when the equipment is marked unobtainable', () => {
      vi.mocked(getEntry).mockReturnValue({
        id: 'sword',
        unobtainable: true,
      } as EquipmentContent);

      debugGiveEquipment('sword' as EquipmentId, 3);

      expect(armoryAdd).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalled();
    });
  });

  describe('debugGiveAllEquipment', () => {
    it('adds one of every equipment entry to the armory by default', () => {
      const sword = { id: 'sword' } as EquipmentContent;
      const shield = { id: 'shield' } as EquipmentContent;
      vi.mocked(getEntriesByType).mockReturnValue([sword, shield]);

      debugGiveAllEquipment();

      expect(armoryAdd).toHaveBeenCalledTimes(2);
      expect(armoryAdd).toHaveBeenCalledWith('sword', 1);
      expect(armoryAdd).toHaveBeenCalledWith('shield', 1);
    });

    it('skips equipment marked unobtainable', () => {
      const sword = { id: 'sword' } as EquipmentContent;
      const cursed = { id: 'cursed', unobtainable: true } as EquipmentContent;
      vi.mocked(getEntriesByType).mockReturnValue([sword, cursed]);

      debugGiveAllEquipment();

      expect(armoryAdd).toHaveBeenCalledTimes(1);
      expect(armoryAdd).toHaveBeenCalledWith('sword', 1);
    });

    it('adds the given quantity of every equipment entry', () => {
      const sword = { id: 'sword' } as EquipmentContent;
      vi.mocked(getEntriesByType).mockReturnValue([sword]);

      debugGiveAllEquipment(5);

      expect(armoryAdd).toHaveBeenCalledWith('sword', 5);
    });

    it('does nothing for a zero or negative quantity', () => {
      debugGiveAllEquipment(0);
      debugGiveAllEquipment(-1);

      expect(getEntriesByType).not.toHaveBeenCalled();
      expect(armoryAdd).not.toHaveBeenCalled();
    });
  });

  describe('debugGiveCollectible', () => {
    it('adds the given quantity of the collectible when it resolves to real content', () => {
      vi.mocked(getEntry).mockReturnValue({
        id: 'founding-stone',
      } as CollectibleContent);

      debugGiveCollectible('founding-stone' as CollectibleId, 2);

      expect(collectiblesAdd).toHaveBeenCalledWith('founding-stone', 2);
    });

    it('does nothing for a zero or negative quantity', () => {
      debugGiveCollectible('founding-stone' as CollectibleId, 0);
      debugGiveCollectible('founding-stone' as CollectibleId, -1);

      expect(collectiblesAdd).not.toHaveBeenCalled();
    });

    it('does nothing and warns when the collectible id does not resolve to real content', () => {
      vi.mocked(getEntry).mockReturnValue(undefined);

      debugGiveCollectible('unknown-collectible' as CollectibleId, 2);

      expect(collectiblesAdd).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalled();
    });

    it('does nothing and warns when the collectible is marked unobtainable', () => {
      vi.mocked(getEntry).mockReturnValue({
        id: 'founding-stone',
        unobtainable: true,
      } as CollectibleContent);

      debugGiveCollectible('founding-stone' as CollectibleId, 2);

      expect(collectiblesAdd).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalled();
    });
  });

  describe('debugSetCharacterLevel', () => {
    function runWithParty(party: Character[]): { party: Character[] } {
      const captured = { party };
      vi.mocked(updateGamestate).mockImplementation((func) => {
        const state = { world: { party: captured.party } } as unknown as GameState;
        const result = func(state);
        captured.party = result.world.party;
        return Promise.resolve();
      });
      return captured;
    }

    function makeCharacter(overrides: Partial<Character> = {}): Character {
      return {
        id: 'hero-1' as CharacterId,
        level: 10,
        xp: { current: 50, maximum: 200 },
        hp: 40,
        ep: 20,
        stats: { Health: 50, Energy: 25 } as StatBlock,
        ...overrides,
      } as Character;
    }

    it('sets the level, resets xp, and recomputes stats for the matching character', () => {
      const character = makeCharacter();
      vi.mocked(characterStatsForLevel).mockReturnValue({
        Health: 100,
        Energy: 60,
      } as StatBlock);
      vi.mocked(characterXpForLevel).mockReturnValue(500);

      const captured = runWithParty([character]);
      debugSetCharacterLevel('hero-1' as CharacterId, 20);

      expect(captured.party[0].level).toBe(20);
      expect(captured.party[0].xp).toEqual({ current: 0, maximum: 500 });
      expect(captured.party[0].stats).toEqual({ Health: 100, Energy: 60 });
      expect(captured.party[0].hp).toBe(40);
      expect(captured.party[0].ep).toBe(20);
    });

    it('clamps hp/ep down when the new level has lower stats', () => {
      const character = makeCharacter({ hp: 45, ep: 25 });
      vi.mocked(characterStatsForLevel).mockReturnValue({
        Health: 10,
        Energy: 5,
      } as StatBlock);
      vi.mocked(characterXpForLevel).mockReturnValue(20);

      const captured = runWithParty([character]);
      debugSetCharacterLevel('hero-1' as CharacterId, 1);

      expect(captured.party[0].hp).toBe(10);
      expect(captured.party[0].ep).toBe(5);
    });

    it('clamps the requested level to the valid range', () => {
      const character = makeCharacter();
      vi.mocked(characterStatsForLevel).mockReturnValue({
        Health: 100,
        Energy: 60,
      } as StatBlock);
      vi.mocked(characterXpForLevel).mockReturnValue(100);

      const captured = runWithParty([character]);
      debugSetCharacterLevel('hero-1' as CharacterId, 500);

      expect(captured.party[0].level).toBe(99);
    });

    it('does not modify characters that do not match the id', () => {
      const character = makeCharacter();
      vi.mocked(characterStatsForLevel).mockReturnValue({
        Health: 100,
        Energy: 60,
      } as StatBlock);
      vi.mocked(characterXpForLevel).mockReturnValue(500);

      const captured = runWithParty([character]);
      debugSetCharacterLevel('other-hero' as CharacterId, 20);

      expect(captured.party[0]).toEqual(character);
    });
  });

  describe('debugSetTradeskillLevel', () => {
    const WOODWORKING_ID = 'woodworking-id' as TradeskillId;

    function runWithTradeskills(building: TradeskillBuildingState): {
      building: TradeskillBuildingState;
    } {
      const captured = { building };
      vi.mocked(tradeskillIdForName).mockReturnValue(WOODWORKING_ID);
      vi.mocked(updateGamestate).mockImplementation((func) => {
        const state = {
          tradeskills: { [WOODWORKING_ID]: captured.building },
        } as unknown as GameState;
        const result = func(state);
        captured.building = result.tradeskills[WOODWORKING_ID];
        return Promise.resolve();
      });
      return captured;
    }

    it('sets the level and resets xp for the tradeskill', () => {
      vi.mocked(tradeskillXpForLevel).mockReturnValue(500);

      const captured = runWithTradeskills({
        level: 10,
        xp: { current: 50, maximum: 200 },
        queue: [],
      });
      debugSetTradeskillLevel('Woodworking', 20);

      expect(captured.building.level).toBe(20);
      expect(captured.building.xp).toEqual({ current: 0, maximum: 500 });
    });

    it('clamps the requested level to the valid range', () => {
      vi.mocked(tradeskillXpForLevel).mockReturnValue(5000);

      const captured = runWithTradeskills({
        level: 10,
        xp: { current: 50, maximum: 200 },
        queue: [],
      });
      debugSetTradeskillLevel('Woodworking', 500);

      expect(captured.building.level).toBe(50);
    });

    it('clamps the requested level up to a minimum of 1', () => {
      vi.mocked(tradeskillXpForLevel).mockReturnValue(10);

      const captured = runWithTradeskills({
        level: 10,
        xp: { current: 50, maximum: 200 },
        queue: [],
      });
      debugSetTradeskillLevel('Woodworking', -5);

      expect(captured.building.level).toBe(1);
    });
  });

  describe('debugResetBestiary', () => {
    it('clears every bestiary entry', () => {
      debugResetBestiary();

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        bestiary: { goblin: { foundAt: 1, kills: 1 } },
      } as unknown as GameState);

      expect(result.bestiary).toEqual({});
    });
  });

  describe('debugDiscoverWorldNode', () => {
    it('delegates to worldNodeDiscover', () => {
      debugDiscoverWorldNode('Hidden Grove');

      expect(worldNodeDiscover).toHaveBeenCalledWith('Hidden Grove');
    });
  });

  describe('debugUndiscoverWorldNode', () => {
    it('delegates to worldNodeUndiscover', () => {
      debugUndiscoverWorldNode('Hidden Grove');

      expect(worldNodeUndiscover).toHaveBeenCalledWith('Hidden Grove');
    });
  });

  describe('debugWipeWorldDiscoveries', () => {
    it('clears every world discovery entry', () => {
      debugWipeWorldDiscoveries();

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        worldDiscoveries: { 'Hidden Grove': { foundAt: 1000 } },
      } as unknown as GameState);

      expect(result.worldDiscoveries).toEqual({});
    });
  });
});
