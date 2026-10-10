import type {
  AffixId,
  Character,
  EquipmentId,
  EquipmentItem,
  EquipmentItemId,
  GameState,
  IsContentItem,
  ItemId,
  JobId,
} from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/item/affix', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  rollAffixIds: vi.fn(),
}));

import { ensureAffix } from '@helpers/content/ensure-affix';
import { ensureEquipment, ensureItem } from '@helpers/content/ensure-item';
import { ensureJob } from '@helpers/content/ensure-job';
import { defaultGameState, defaultStats } from '@helpers/defaults';
import {
  characterRecalculateStats,
  createCharacter,
} from '@helpers/hero/party';
import { rollAffixIds } from '@helpers/item/affix';
import {
  applyEquipmentReforge,
  equipmentItemReforgeCost,
  isReforgeable,
  isReforgeUnlocked,
  reforgedEquipmentItem,
} from '@helpers/item/reforge';
import { buildCombat, buildEquipmentItem } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';

describe('reforge', () => {
  const gold = ensureItem({ id: 'gold' as ItemId, name: 'Gold Coin' });
  const flux = ensureItem({ id: 'flux' as ItemId, name: 'Duskhall Flux' });
  const gem = ensureItem({ id: 'gem' as ItemId, name: 'Gem' });
  const job = ensureJob({
    id: 'job-explorer' as JobId,
    name: 'Explorer',
    baseStats: { ...defaultStats(), Health: 100, Energy: 20, Strength: 5 },
    equippableTypes: ['Spear'],
  });
  const commonRing = ensureEquipment({
    id: 'ring' as EquipmentId,
    name: 'Ring',
    rarity: 'Common',
  });
  const rareSpear = ensureEquipment({
    id: 'spear' as EquipmentId,
    name: 'Spear',
    rarity: 'Rare',
    levelRequirement: 10,
    type: 'Spear',
    slots: 1,
  });
  const socketAffix = ensureAffix({
    id: 'socketed' as AffixId,
    name: 'Socketed',
    family: 'Socket',
    effects: [{ kind: 'InfusionSlot', value: 1 }],
  });
  const strengthAffix = ensureAffix({
    id: 'strong' as AffixId,
    name: 'of Strength',
    family: 'Strength',
    effects: [{ kind: 'Stat', stat: 'Strength', value: 3 }],
  });

  const content: IsContentItem[] = [
    gold,
    flux,
    gem,
    job,
    commonRing,
    rareSpear,
    socketAffix,
    strengthAffix,
  ];

  // Rare, level 10: 10 * 25 * 3 gold, 2 flux.
  const spearCost = 750;
  const spearFlux = 2;

  let itemCounter = 0;
  function spearItem(overrides: Partial<EquipmentItem> = {}): EquipmentItem {
    return buildEquipmentItem(rareSpear.id, {
      id: `item-${itemCounter++}` as EquipmentItemId,
      ...overrides,
    });
  }

  function stateWith(
    armory: EquipmentItem[],
    party: Character[] = [],
    goldQty = spearCost,
    fluxQty = spearFlux,
  ): GameState {
    const state = defaultGameState();
    state.armory = armory;
    state.world.party = party;
    state.materials = {
      [gold.id]: { quantity: goldQty, foundAt: 1 },
      [flux.id]: { quantity: fluxQty, foundAt: 1 },
    };
    return state;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    seedContent(content);
    vi.mocked(rollAffixIds).mockReturnValue([strengthAffix.id]);
  });

  describe('isReforgeUnlocked', () => {
    it('stays locked until Duskhall Flux is discovered', () => {
      seedGamestate((state) => {
        state.discoveredMaterials[gold.id] = { foundAt: 1 };
      });
      expect(isReforgeUnlocked()).toBe(false);

      seedGamestate((state) => {
        state.discoveredMaterials[flux.id] = { foundAt: 1 };
      });
      expect(isReforgeUnlocked()).toBe(true);
    });
  });

  describe('isReforgeable', () => {
    it('excludes common gear, which rolls no affixes', () => {
      expect(isReforgeable(commonRing)).toBe(false);
      expect(isReforgeable(rareSpear)).toBe(true);
    });
  });

  describe('equipmentItemReforgeCost', () => {
    it('scales gold by level and rarity and adds rarity-based flux', () => {
      expect(equipmentItemReforgeCost(spearItem())).toEqual([
        { itemId: gold.id, required: spearCost },
        { itemId: flux.id, required: spearFlux },
      ]);
    });

    it('is empty for common gear', () => {
      const ring = { ...spearItem(), equipmentId: commonRing.id };
      expect(equipmentItemReforgeCost(ring)).toEqual([]);
    });
  });

  describe('reforgedEquipmentItem', () => {
    it('keeps identity and base-socket infusions while rerolling affixes', () => {
      const item = spearItem({
        infusedItemIds: [gem.id],
        affixIds: [socketAffix.id],
      });

      const reforged = reforgedEquipmentItem(item);

      expect(reforged.id).toBe(item.id);
      expect(reforged.equipmentId).toBe(item.equipmentId);
      expect(reforged.affixIds).toEqual([strengthAffix.id]);
      expect(reforged.infusedItemIds).toEqual([gem.id]);
      expect(rollAffixIds).toHaveBeenCalledWith(rareSpear, true);
    });

    it('drops gems from affix-added sockets the new roll no longer grants', () => {
      const item = spearItem({
        infusedItemIds: [gem.id, gem.id],
        affixIds: [socketAffix.id],
      });

      expect(reforgedEquipmentItem(item).infusedItemIds).toEqual([gem.id]);
    });

    it('keeps gems in affix-added sockets when the new roll still grants them', () => {
      vi.mocked(rollAffixIds).mockReturnValue([socketAffix.id]);
      const item = spearItem({
        infusedItemIds: [gem.id, gem.id],
        affixIds: [socketAffix.id],
      });

      expect(reforgedEquipmentItem(item).infusedItemIds).toEqual([
        gem.id,
        gem.id,
      ]);
    });
  });

  describe('applyEquipmentReforge', () => {
    it('rerolls an armory item in place and spends the cost', () => {
      const item = spearItem();
      const state = stateWith([item]);

      expect(applyEquipmentReforge(state, item.id)).toBe('ok');
      expect(state.armory[0]).toMatchObject({
        id: item.id,
        affixIds: [strengthAffix.id],
      });
      expect(state.materials[gold.id]?.quantity ?? 0).toBe(0);
      expect(state.materials[flux.id]?.quantity ?? 0).toBe(0);
    });

    it('replaces an equipped two-hander in both slots and recalculates stats', () => {
      const hero = createCharacter('Jala', job.id);
      const item = spearItem();
      hero.equipment.Weapon = item;
      hero.equipment.Offhand = item;
      const baseline = characterRecalculateStats(hero).stats.Strength;
      const state = stateWith([], [hero]);

      expect(applyEquipmentReforge(state, item.id)).toBe('ok');

      const updated = state.world.party[0];
      expect(updated.equipment.Weapon?.affixIds).toEqual([strengthAffix.id]);
      expect(updated.equipment.Offhand).toBe(updated.equipment.Weapon);
      expect(updated.stats.Strength).toBe(baseline + 3);
    });

    it('blocks equipped gear during combat but not armory gear', () => {
      const hero = createCharacter('Jala', job.id);
      const equipped = spearItem();
      hero.equipment.Weapon = equipped;
      hero.equipment.Offhand = equipped;
      const stored = spearItem();
      const state = stateWith([stored], [hero], spearCost * 2, spearFlux * 2);
      state.world.combat = buildCombat();

      expect(applyEquipmentReforge(state, equipped.id)).toBe('in-combat');
      expect(applyEquipmentReforge(state, stored.id)).toBe('ok');
    });

    it('leaves state untouched when unaffordable or missing', () => {
      const item = spearItem();
      const state = stateWith([item], [], spearCost - 1);

      expect(applyEquipmentReforge(state, item.id)).toBe('unaffordable');
      expect(applyEquipmentReforge(state, 'gone' as EquipmentItemId)).toBe(
        'missing',
      );
      expect(state.armory[0]).toBe(item);
      expect(state.materials[gold.id]?.quantity).toBe(spearCost - 1);
    });

    it('is unaffordable when only the flux falls short', () => {
      const item = spearItem();
      const state = stateWith([item], [], spearCost, spearFlux - 1);

      expect(applyEquipmentReforge(state, item.id)).toBe('unaffordable');
      expect(state.armory[0]).toBe(item);
    });

    it('leaves an equipped item and its hero untouched when unaffordable', () => {
      const hero = createCharacter('Jala', job.id);
      const item = spearItem();
      hero.equipment.Weapon = item;
      hero.equipment.Offhand = item;
      const state = stateWith([], [hero], 0);

      expect(applyEquipmentReforge(state, item.id)).toBe('unaffordable');
      expect(state.world.party[0]).toBe(hero);
    });

    it('leaves heroes not wearing the item untouched', () => {
      const wearer = createCharacter('Jala', job.id);
      const bystander = createCharacter('Bo', job.id);
      const item = spearItem();
      wearer.equipment.Weapon = item;
      wearer.equipment.Offhand = item;
      const state = stateWith([], [wearer, bystander]);

      expect(applyEquipmentReforge(state, item.id)).toBe('ok');
      expect(state.world.party[1]).toBe(bystander);
    });

    it('refuses common gear', () => {
      const ring = { ...spearItem(), equipmentId: commonRing.id };
      expect(applyEquipmentReforge(stateWith([ring]), ring.id)).toBe(
        'not-reforgeable',
      );
    });
  });
});
