import {
  categoryMessageLog,
  ITEM_ICON_TOKEN,
  itemDropHtml,
} from '@helpers/combat/combat-log';
import { grantResolvedDrops } from '@helpers/combat/combat-rewards';
import {
  RAID_LOSS_CRAFT_DEBUFF_TICKS,
  RAID_LOSS_MATERIAL_STEAL_PERCENT,
  RAID_LOSS_REPUTATION_AMOUNT,
  RAID_LOSS_STOCK_MAX_STEAL_PERCENT,
  RAID_WIN_REPUTATION_AMOUNT,
} from '@helpers/config';
import { getEntry } from '@helpers/content/content';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { formatDuration, timerTicksElapsed } from '@helpers/engine/timer';
import { resolveRewardDisplay } from '@helpers/item/item-preview';
import {
  combatItemDropRateBoost,
  rollDroppedRewards,
} from '@helpers/item/loot';
import { rngNumberRange, rngShuffle } from '@helpers/rng';
import {
  updateGamestate,
  worldCurrentLocationState,
} from '@helpers/state-game';
import { raidDefenseGlobalEffectApply } from '@helpers/town/raid/town-raid-defense';
import {
  townReputationGain,
  townReputationLose,
  townReputationTier,
} from '@helpers/town/reputation/town-reputation';
import { townReputationBuffRefresh } from '@helpers/town/reputation/town-reputation-buff';
import { townCommissionRefreshTierScaledSlots } from '@helpers/town/town-commission-generate';
import { townShopItemCap } from '@helpers/town/shop/town-shop-access';
import { townStockDisplay } from '@helpers/town/shop/town-stock';
import { applyTownMaterialDelta } from '@helpers/town/town-materials';
import { updateTownNode } from '@helpers/town/town-node';
import type {
  Combat,
  GameState,
  ItemContent,
  ItemId,
  RecipeContent,
  TownContent,
  TownId,
  TownRaidLossSummary,
} from '@interfaces';

// Grants the town's raid-only reward table through the same pipeline monster kills use.
export function raidResolveVictory(combat: Combat, townId: TownId): void {
  const town = getEntry<TownContent>(townId);
  if (!town) return;

  analyticsSendDesignEvent(`Town:Raid:Win:${analyticsSafeSegment(town.name)}`);

  const drops = rollDroppedRewards(
    town.defense.rewards,
    town.level,
    combatItemDropRateBoost(),
  );
  grantResolvedDrops(combat, drops);

  // Not awaited: this always runs inside a tick, where updateGamestate mutates synchronously,
  // so the tier read right below already sees the change without needing the returned promise.
  const previousTier = townReputationTier(townId);
  townReputationGain(townId, RAID_WIN_REPUTATION_AMOUNT, 'RaidDefense');
  if (townReputationTier(townId) !== previousTier) {
    townReputationBuffRefresh(worldCurrentLocationState().mapName);
    townCommissionRefreshTierScaledSlots(townId);
  }

  updateGamestate((state) =>
    updateTownNode(state, townId, (target) => {
      target.lastRaidResolvedAtTick = timerTicksElapsed();
    }),
  );
}

// 1 to 50% of the stock cap (not the current stock count) - picked randomly from whatever stock actually exists.
function stealTownStock(state: GameState, townId: TownId): string[] {
  const { stock } = state.world.towns[townId];
  if (stock.length === 0) return [];

  const maxSlots = Math.max(
    1,
    Math.floor(
      townShopItemCap(townId) * (RAID_LOSS_STOCK_MAX_STEAL_PERCENT / 100),
    ),
  );
  const stolenCount = Math.min(stock.length, rngNumberRange(1, maxSlots + 1));
  const stolenEntries = rngShuffle(stock).slice(0, stolenCount);

  updateTownNode(state, townId, (town) => {
    town.stock = town.stock.filter((entry) => !stolenEntries.includes(entry));
  });

  return stolenEntries
    .map((entry) => townStockDisplay(entry)?.name)
    .filter((name): name is string => !!name);
}

// The whole queue is scrapped - materials already consumed for it are gone too, not refunded.
function cancelTownCraftQueue(state: GameState, townId: TownId): string[] {
  const { craftQueue } = state.world.towns[townId];
  if (craftQueue.length === 0) return [];

  const names = craftQueue
    .map((entry) => {
      const recipe = getEntry<RecipeContent>(entry.recipeId);
      return recipe ? resolveRewardDisplay(recipe.result)?.name : undefined;
    })
    .filter((name): name is string => !!name);

  updateTownNode(state, townId, (town) => {
    town.craftQueue = [];
  });

  return names;
}

// A flat % of every material stack the town holds, rounded down.
function stealTownMaterials(
  state: GameState,
  townId: TownId,
): TownRaidLossSummary['lostMaterials'] {
  // A snapshot is safe: each stack is only decremented once, by its own loop pass.
  const { materials } = state.world.towns[townId];

  return (Object.keys(materials) as ItemId[])
    .map((itemId) => {
      const stolen = Math.floor(
        (materials[itemId] ?? 0) * (RAID_LOSS_MATERIAL_STEAL_PERCENT / 100),
      );
      if (stolen <= 0) return undefined;

      applyTownMaterialDelta(state, townId, itemId, -stolen);

      const item = getEntry<ItemContent>(itemId);
      return item ? { item, quantity: stolen } : undefined;
    })
    .filter(
      (entry): entry is TownRaidLossSummary['lostMaterials'][number] => !!entry,
    );
}

function logRaidLossMessages(
  townName: string,
  summary: TownRaidLossSummary,
): void {
  if (summary.stolenItemNames.length > 0) {
    categoryMessageLog(
      'Raid',
      townName,
      `${townName} lost the following items: ${summary.stolenItemNames.join(', ')}`,
    );
  }

  if (summary.cancelledCraftNames.length > 0) {
    categoryMessageLog(
      'Raid',
      townName,
      `${townName} lost the following in-progress crafts: ${summary.cancelledCraftNames.join(', ')}`,
    );
  }

  if (summary.lostMaterials.length > 0) {
    const [first, ...rest] = summary.lostMaterials;
    const descriptions = [
      `${ITEM_ICON_TOKEN}${itemDropHtml(first.item, first.quantity)}`,
      ...rest.map(({ item, quantity }) => itemDropHtml(item, quantity)),
    ];
    categoryMessageLog(
      'Raid',
      townName,
      `${townName} lost these resources: ${descriptions.join(', ')}`,
      { sprite: first.item.sprite, spritesheet: 'item' },
    );
  }

  categoryMessageLog(
    'Raid',
    townName,
    `${townName}'s crafting is slowed for ${formatDuration(RAID_LOSS_CRAFT_DEBUFF_TICKS)} following the raid.`,
  );
}

// Combat-object-agnostic (shared with the no-Combat auto-expire path) - callers log their own message.
export function raidResolveDefeat(townId: TownId): void {
  const town = getEntry<TownContent>(townId);
  if (!town) return;

  analyticsSendDesignEvent(`Town:Raid:Loss:${analyticsSafeSegment(town.name)}`);

  // Not awaited - see the matching comment in raidResolveVictory.
  const previousTier = townReputationTier(townId);
  townReputationLose(townId, RAID_LOSS_REPUTATION_AMOUNT, 'RaidDefense');
  if (townReputationTier(townId) !== previousTier) {
    townReputationBuffRefresh(worldCurrentLocationState().mapName);
    townCommissionRefreshTierScaledSlots(townId);
  }

  const now = timerTicksElapsed();
  let summary: TownRaidLossSummary | undefined;

  updateGamestate((state) => {
    if (!state.world.towns[townId]) return state;

    summary = {
      stolenItemNames: stealTownStock(state, townId),
      cancelledCraftNames: cancelTownCraftQueue(state, townId),
      lostMaterials: stealTownMaterials(state, townId),
    };

    updateTownNode(state, townId, (target) => {
      target.lastRaidResolvedAtTick = now;
      target.craftSpeedDebuffExpiresAtTick = now + RAID_LOSS_CRAFT_DEBUFF_TICKS;
      target.raidTelegraphedAtTick = undefined;
      target.raidEngageWindowExpiresAtTick = undefined;
      target.raidTelegraphedAssaulterIds = undefined;
    });
    raidDefenseGlobalEffectApply(state, now);
    return state;
  });

  if (summary) logRaidLossMessages(town.name, summary);
}
