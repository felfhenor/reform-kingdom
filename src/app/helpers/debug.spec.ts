import type {
  CollectibleContent,
  CollectibleId,
  EquipmentContent,
  EquipmentId,
  ItemContent,
  ItemId,
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

vi.mock('@helpers/state-options', () => ({
  setOption: vi.fn(),
}));

import { armoryAdd } from '@helpers/armory';
import { collectiblesAdd } from '@helpers/collectibles';
import { getEntriesByType, getEntry } from '@helpers/content';
import {
  debugGiveAllEquipment,
  debugGiveCollectible,
  debugGiveEquipment,
  debugGiveItem,
} from '@helpers/debug';
import { addMaterial } from '@helpers/materials';

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
});
