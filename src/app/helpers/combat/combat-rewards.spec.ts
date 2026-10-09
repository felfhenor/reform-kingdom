import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/engine/gather-vfx');
vi.mock('@helpers/task/task-events');

import { combatLog } from '@helpers/combat/combat-log';
import { grantResolvedDrops } from '@helpers/combat/combat-rewards';
import {
  ensureCollectible,
  ensureEquipment,
  ensureItem,
} from '@helpers/content/ensure-item';
import { ensureRecipe } from '@helpers/content/ensure-recipe';
import { ensureWorker } from '@helpers/content/ensure-worker';
import { defaultGameState } from '@helpers/defaults';
import { gatherVfxEmit } from '@helpers/engine/gather-vfx';
import { ledgerMark } from '@helpers/engine/ledger';
import { isCollectibleDiscovered } from '@helpers/item/collectibles';
import { getMaterialQuantity } from '@helpers/item/materials';
import { armoryOverflowCapForState } from '@helpers/kingdom/armory-global-effects';
import { armoryState, discoveredRecipesState } from '@helpers/state-game';
import { isWorkerRescued } from '@helpers/worker/worker-discovery';
import type {
  CollectibleId,
  Combat,
  EncounterId,
  EncounterRandomId,
  EquipmentId,
  GameState,
  ItemId,
  RecipeId,
  ResolvedDrop,
  TownId,
  WorkerId,
} from '@interfaces';
import { buildCombat, buildEquipmentItem } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';

const sword = ensureEquipment({
  id: 'iron-sword' as EquipmentId,
  name: 'Iron Sword',
  sprite: 'sword-sprite',
});
const ore = ensureItem({ id: 'ore' as ItemId, name: 'Copper Ore' });
const gold = ensureItem({ id: 'gold' as ItemId, name: 'Gold Coin' });
const coin = ensureCollectible({
  id: 'old-coin' as CollectibleId,
  name: 'Old Coin',
});
const recipe = ensureRecipe({
  id: 'recipe-sword' as RecipeId,
  name: 'Recipe: Iron Sword',
  result: { equipmentId: sword.id },
});
const nell = ensureWorker({
  id: 'weaver-nell' as WorkerId,
  name: 'Weaver Nell',
});

function fight(overrides: Partial<Combat> = {}): Combat {
  return buildCombat({ locationName: 'Wergen Woods', ...overrides });
}

function grant(
  drops: ResolvedDrop[],
  combat = fight(),
  edit: (state: GameState) => void = () => undefined,
): void {
  seedGamestate(edit);
  inTick(() => grantResolvedDrops(combat, drops));
}

function logMessages(): string[] {
  return combatLog().map((entry) => entry.message);
}

function vfxQuantities(): number[] {
  return vi.mocked(gatherVfxEmit).mock.calls.map(([event]) => event.quantity);
}

beforeEach(() => {
  vi.clearAllMocks();
  seedContent([sword, ore, gold, coin, recipe, nell]);
});

describe('grantResolvedDrops', () => {
  it('grants equipment to the armory, logging and showing the find', () => {
    grant([{ kind: 'Equipment', equipmentId: sword.id }]);

    expect(armoryState().map((item) => item.equipmentId)).toEqual([sword.id]);
    expect(logMessages()).toEqual([expect.stringContaining('Iron Sword')]);
    expect(gatherVfxEmit).toHaveBeenCalledWith({
      nodeName: 'Wergen Woods',
      quantity: 1,
      name: sword.name,
      sprite: sword.sprite,
      spritesheet: 'equipment',
    });
  });

  it('auto-sells equipment the loot filter rejects, without showing a find', () => {
    grant([{ kind: 'Equipment', equipmentId: sword.id }], fight(), (state) => {
      state.lootFilters.minimumItemLevel = sword.levelRequirement + 1;
    });

    expect(armoryState()).toEqual([]);
    expect(logMessages()).toEqual([
      expect.stringContaining('automatically sold'),
    ]);
    expect(getMaterialQuantity(gold.id)).toBeGreaterThan(0);
    expect(gatherVfxEmit).not.toHaveBeenCalled();
  });

  it('loses equipment once the armory is past even its loot overflow, saying so', () => {
    const full = Array.from(
      { length: armoryOverflowCapForState(defaultGameState()) },
      () => buildEquipmentItem(sword.id),
    );

    grant([{ kind: 'Equipment', equipmentId: sword.id }], fight(), (state) => {
      state.armory = full;
    });

    expect(armoryState()).toHaveLength(full.length);
    expect(logMessages()).toEqual([expect.stringContaining('armory is full')]);
    expect(gatherVfxEmit).not.toHaveBeenCalled();
  });

  it('grants a collectible, logging the find', () => {
    grant([{ kind: 'Collectible', collectibleId: coin.id }]);

    expect(isCollectibleDiscovered(coin.id)).toBe(true);
    expect(logMessages()).toEqual([expect.stringContaining('Old Coin')]);
    expect(vfxQuantities()).toEqual([1]);
  });

  it('discovers a recipe once, staying silent on a repeat', () => {
    grant([{ kind: 'Recipe', recipeId: recipe.id }]);
    expect(discoveredRecipesState()[recipe.id]).toBeDefined();
    expect(logMessages()).toHaveLength(1);

    vi.clearAllMocks();
    grant([{ kind: 'Recipe', recipeId: recipe.id }], fight(), (state) =>
      ledgerMark(state.discoveredRecipes, recipe.id),
    );
    expect(logMessages()).toHaveLength(1);
    expect(gatherVfxEmit).not.toHaveBeenCalled();
  });

  it('rescues a worker once, staying silent on a repeat', () => {
    grant([{ kind: 'Worker', workerId: nell.id }]);
    expect(isWorkerRescued(nell.id)).toBe(true);
    expect(logMessages()).toEqual([expect.stringContaining('Weaver Nell')]);

    vi.clearAllMocks();
    grant([{ kind: 'Worker', workerId: nell.id }], fight(), (state) => {
      state.discoveredWorkers[nell.id] = { foundAt: 1 };
    });
    expect(logMessages()).toHaveLength(1);
    expect(gatherVfxEmit).not.toHaveBeenCalled();
  });

  it('adds up repeated item drops into one grant and one log line', () => {
    grant([
      { kind: 'Item', itemId: ore.id, quantity: 2 },
      { kind: 'Item', itemId: ore.id, quantity: 3 },
    ]);

    expect(getMaterialQuantity(ore.id)).toBe(5);
    expect(logMessages()).toEqual([expect.stringContaining('copper ore')]);
    expect(vfxQuantities()).toEqual([5]);
  });

  describe('gold gain buffs', () => {
    const goldDrop: ResolvedDrop[] = [
      { kind: 'Item', itemId: gold.id, quantity: 100 },
      { kind: 'Item', itemId: ore.id, quantity: 100 },
    ];
    const buffed = (state: GameState) =>
      (state.globalEffectSums.goldGainMultiplierBonus = 0.2);

    it('boosts gold, and only gold, won exploring', () => {
      grant(goldDrop, fight({ encounterId: 'field' as EncounterId }), buffed);

      expect(getMaterialQuantity(gold.id)).toBe(120);
      expect(getMaterialQuantity(ore.id)).toBe(100);

      grant(
        goldDrop,
        fight({ encounterRandomId: 'shrine' as EncounterRandomId }),
        buffed,
      );
      expect(getMaterialQuantity(gold.id)).toBe(120);
    });

    it('never boosts gold won defending a town', () => {
      grant(goldDrop, fight({ raidTownId: 'larsia' as TownId }), buffed);

      expect(getMaterialQuantity(gold.id)).toBe(100);
    });
  });
});
