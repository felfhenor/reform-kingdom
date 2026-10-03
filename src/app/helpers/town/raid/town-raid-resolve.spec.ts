import type * as RngHelper from '@helpers/rng';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/combat/combat-rewards');
vi.mock('@helpers/town/reputation/town-reputation-buff');
vi.mock('@helpers/town/town-commission-generate');
vi.mock('@helpers/rng', async (importOriginal) => ({
  ...(await importOriginal<typeof RngHelper>()),
  rngNumberRange: vi.fn((_min: number, max: number) => max - 1),
  rngShuffle: vi.fn((items: unknown[]) => items),
}));

import { combatLog } from '@helpers/combat/combat-log';
import { grantResolvedDrops } from '@helpers/combat/combat-rewards';
import {
  RAID_LOSS_CRAFT_DEBUFF_TICKS,
  RAID_LOSS_MATERIAL_STEAL_PERCENT,
  RAID_LOSS_REPUTATION_AMOUNT,
  RAID_LOSS_STOCK_MAX_STEAL_PERCENT,
  RAID_WIN_REPUTATION_AMOUNT,
} from '@helpers/config';
import { ensureEquipment, ensureItem } from '@helpers/content/ensure-item';
import { ensureRecipe } from '@helpers/content/ensure-recipe';
import { ensureTown } from '@helpers/content/ensure-town';
import { worldTownsState } from '@helpers/state-game';
import {
  raidResolveDefeat,
  raidResolveVictory,
} from '@helpers/town/raid/town-raid-resolve';
import { TOWN_REPUTATION_THRESHOLDS } from '@helpers/town/reputation/town-reputation';
import { townReputationBuffRefresh } from '@helpers/town/reputation/town-reputation-buff';
import { townCommissionRefreshTierScaledSlots } from '@helpers/town/town-commission-generate';
import type {
  EquipmentId,
  ItemId,
  MonsterId,
  RecipeId,
  ResolvedDrop,
  TownContent,
  TownId,
  TownNodeState,
} from '@interfaces';
import { captureAnalyticsEvents } from '@/testing/analytics';
import {
  buildCombat,
  buildTownCraftQueueEntry,
  buildTownNodeState,
  buildTownStockEntry,
} from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';

const townId = 'larsia' as TownId;
const trophyId = 'raid-trophy' as EquipmentId;
const now = 1000;

const shopCap = 4;
// One more than the shop can ever hold, so any steal percent leaves a survivor.
const equipment = Array.from({ length: shopCap + 1 }, (_, i) =>
  ensureEquipment({ id: `gear-${i}` as EquipmentId, name: `Gear ${i}` }),
);
const ore = ensureItem({
  id: 'ore' as ItemId,
  name: 'Ore',
  sprite: 'ore-sprite',
});
const wood = ensureItem({
  id: 'wood' as ItemId,
  name: 'Wood',
  sprite: 'wood-sprite',
});

function town(sellItemCount = shopCap): TownContent {
  return ensureTown({
    id: townId,
    name: 'Larsia',
    level: 25,
    traders: {
      sellItemCount: [{ tier: 0, value: sellItemCount }],
    } as TownContent['traders'],
    defense: {
      rewards: [{ kind: 'Equipment', equipmentId: trophyId, chance: 100 }],
    } as TownContent['defense'],
  });
}

function seedTown(
  overrides: Partial<TownNodeState> = {},
  content = town(),
): void {
  seedContent([
    content,
    ...equipment,
    ensureEquipment({ id: trophyId, name: 'Raid Trophy' }),
    ore,
    wood,
  ]);
  seedGamestate((state) => {
    state.clock.numTicks = now;
    state.world.currentLocation.mapName = 'LarsianDesert';
    state.world.towns[townId] = buildTownNodeState(overrides);
  });
}

function townState(): TownNodeState {
  return worldTownsState()[townId];
}

function logMessages(): string[] {
  return combatLog().map((entry) => entry.message);
}

function stockOf(count: number): TownNodeState['stock'] {
  return equipment.slice(0, count).map((item) => buildTownStockEntry(item.id));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('raidResolveVictory', () => {
  const killDrops: ResolvedDrop[] = [
    { kind: 'Item', itemId: ore.id, quantity: 20 },
  ];

  it('grants the kill drops plus the town raid rewards, and gains reputation', () => {
    seedTown();
    const combat = buildCombat();
    const events = captureAnalyticsEvents();

    inTick(() => raidResolveVictory(combat, townId, killDrops));

    expect(grantResolvedDrops).toHaveBeenCalledWith(combat, [
      ...killDrops,
      { kind: 'Equipment', equipmentId: trophyId },
    ]);
    expect(townState().reputation).toBe(RAID_WIN_REPUTATION_AMOUNT);
    expect(townState().lastRaidResolvedAtTick).toBe(now);
    expect(events).toContain('Town:Raid:Win:Larsia');
  });

  it('re-syncs the town buff and commissions only when the gain crosses a tier', () => {
    seedTown({
      reputation:
        TOWN_REPUTATION_THRESHOLDS[2] - RAID_WIN_REPUTATION_AMOUNT - 1,
    });
    inTick(() => raidResolveVictory(buildCombat(), townId, []));
    expect(townReputationBuffRefresh).not.toHaveBeenCalled();

    seedTown({
      reputation: TOWN_REPUTATION_THRESHOLDS[1] - RAID_WIN_REPUTATION_AMOUNT,
    });
    inTick(() => raidResolveVictory(buildCombat(), townId, []));
    expect(townReputationBuffRefresh).toHaveBeenCalledWith('LarsianDesert');
    expect(townCommissionRefreshTierScaledSlots).toHaveBeenCalledWith(townId);
  });

  it('only grants the kill drops when the town no longer resolves', () => {
    seedGamestate();
    const combat = buildCombat();

    inTick(() => raidResolveVictory(combat, townId, killDrops));

    expect(grantResolvedDrops).toHaveBeenCalledWith(combat, killDrops);
    expect(worldTownsState()).toEqual({});
  });
});

describe('raidResolveDefeat', () => {
  const defeat = () => inTick(() => raidResolveDefeat(townId));

  it('loses reputation, slows crafting and clears the raid telegraph', () => {
    seedTown({
      reputation: TOWN_REPUTATION_THRESHOLDS[2],
      raidTelegraphedAtTick: 900,
      raidEngageWindowExpiresAtTick: 1200,
      raidTelegraphedAssaulterIds: ['bloodmoth' as MonsterId],
    });
    const events = captureAnalyticsEvents();

    defeat();

    expect(townState()).toMatchObject({
      reputation: TOWN_REPUTATION_THRESHOLDS[2] - RAID_LOSS_REPUTATION_AMOUNT,
      lastRaidResolvedAtTick: now,
      craftSpeedDebuffExpiresAtTick: now + RAID_LOSS_CRAFT_DEBUFF_TICKS,
      raidTelegraphedAtTick: undefined,
      raidEngageWindowExpiresAtTick: undefined,
      raidTelegraphedAssaulterIds: undefined,
    });
    expect(events).toContain('Town:Raid:Loss:Larsia');
    expect(logMessages()).toEqual([
      expect.stringContaining('crafting is slowed'),
    ]);
  });

  it('re-syncs the town buff and commissions only when the loss crosses a tier', () => {
    seedTown({
      reputation: TOWN_REPUTATION_THRESHOLDS[2] + RAID_LOSS_REPUTATION_AMOUNT,
    });
    defeat();
    expect(townReputationBuffRefresh).not.toHaveBeenCalled();

    seedTown({
      reputation:
        TOWN_REPUTATION_THRESHOLDS[2] + RAID_LOSS_REPUTATION_AMOUNT - 1,
    });
    defeat();
    expect(townReputationBuffRefresh).toHaveBeenCalledWith('LarsianDesert');
    expect(townCommissionRefreshTierScaledSlots).toHaveBeenCalledWith(townId);
  });

  it('does nothing when the town no longer resolves', () => {
    seedGamestate();
    const events = captureAnalyticsEvents();

    defeat();

    expect(worldTownsState()).toEqual({});
    expect(events).toEqual([]);
    expect(logMessages()).toEqual([]);
  });

  it('steals up to its share of the stock cap, logging what was taken', () => {
    const maxStolen = Math.floor(
      shopCap * (RAID_LOSS_STOCK_MAX_STEAL_PERCENT / 100),
    );
    const stock = stockOf(maxStolen + 1);
    seedTown({ stock });

    defeat();

    expect(townState().stock).toEqual(stock.slice(maxStolen));
    const lostItems = logMessages().find((m) =>
      m.includes('lost the following items'),
    );
    equipment.slice(0, maxStolen).forEach(({ name }) => {
      expect(lostItems).toContain(name);
    });
    expect(lostItems).not.toContain(equipment[maxStolen].name);
  });

  it('always steals at least one item, however small the stock cap', () => {
    seedTown({ stock: stockOf(2) }, town(1));

    defeat();

    expect(townState().stock).toHaveLength(1);
  });

  it('scraps the whole craft queue, logging what was being crafted', () => {
    const recipes = equipment.slice(0, 2).map((item) =>
      ensureRecipe({
        id: `recipe-${item.id}` as RecipeId,
        name: item.name,
        result: { equipmentId: item.id },
      }),
    );
    seedTown({
      craftQueue: recipes.map((recipe) =>
        buildTownCraftQueueEntry({ recipeId: recipe.id }),
      ),
    });
    seedContent([town(), ...equipment, ...recipes]);

    defeat();

    expect(townState().craftQueue).toEqual([]);
    const lostCrafts = logMessages().find((m) =>
      m.includes('in-progress crafts'),
    );
    expect(lostCrafts).toContain(equipment[0].name);
    expect(lostCrafts).toContain(equipment[1].name);
  });

  it('takes a share of every material stack, logging each loss with its icon', () => {
    // The largest stack that still rounds down to nothing stolen.
    const tooSmallToLose =
      Math.ceil(100 / RAID_LOSS_MATERIAL_STEAL_PERCENT) - 1;
    seedTown({ materials: { [ore.id]: 10, [wood.id]: tooSmallToLose } });

    defeat();

    const stolen = Math.floor(10 * (RAID_LOSS_MATERIAL_STEAL_PERCENT / 100));
    expect(townState().materials).toEqual({
      [ore.id]: 10 - stolen,
      [wood.id]: tooSmallToLose,
    });
    const entry = combatLog().find((e) => e.message.includes('resources'));
    expect(entry?.message).toContain('ore');
    expect(entry?.message).not.toContain('wood');
    expect(entry?.itemIcons).toEqual([
      { sprite: ore.sprite, spritesheet: 'item' },
    ]);
  });
});
