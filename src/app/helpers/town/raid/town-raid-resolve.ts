import {
  categoryMessageLog,
  ITEM_ICON_TOKEN,
  itemDropHtml,
  rarityNameHtml,
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
import { raidTelegraphClear } from '@helpers/town/raid/town-raid-defense';
import {
  townReputationGain,
  townReputationLose,
  townReputationTier,
} from '@helpers/town/reputation/town-reputation';
import { townReputationBuffRefresh } from '@helpers/town/reputation/town-reputation-buff';
import { townShopItemCap } from '@helpers/town/shop/town-shop-access';
import { townStockDisplay } from '@helpers/town/shop/town-stock';
import { townCommissionRefreshTierScaledSlots } from '@helpers/town/town-commission-generate';
import { applyTownMaterialDelta } from '@helpers/town/town-materials';
import type {
  Combat,
  GameState,
  ItemContent,
  ItemId,
  ItemPreviewDisplay,
  RecipeContent,
  ResolvedDrop,
  TownContent,
  TownId,
  TownRaidLossSummary,
} from '@interfaces';

// Grants the town's raid-only reward table through the same pipeline monster kills use.
export function raidResolveVictory(
  combat: Combat,
  townId: TownId,
  monsterDrops: ResolvedDrop[],
): void {
  const town = getEntry<TownContent>(townId);
  if (!town) {
    grantResolvedDrops(combat, monsterDrops);
    return;
  }

  analyticsSendDesignEvent(`Town:Raid:Win:${analyticsSafeSegment(town.name)}`);

  const drops = rollDroppedRewards(
    town.defense.rewards,
    town.level,
    combatItemDropRateBoost(),
  );
  grantResolvedDrops(combat, [...monsterDrops, ...drops]);

  // Not awaited: this always runs inside a tick, where updateGamestate mutates synchronously,
  // so the tier read right below already sees the change without needing the returned promise.
  const previousTier = townReputationTier(townId);
  townReputationGain(townId, RAID_WIN_REPUTATION_AMOUNT, 'RaidDefense');
  if (townReputationTier(townId) !== previousTier) {
    townReputationBuffRefresh(worldCurrentLocationState().mapName);
    townCommissionRefreshTierScaledSlots(townId);
  }

  updateGamestate((state) => {
    const target = state.world.towns[townId];
    if (!target) return state;

    target.lastRaidResolvedAtTick = timerTicksElapsed();

    return state;
  });
}

// 1 to 50% of the stock cap (not the current stock count) - picked randomly from whatever stock actually exists.
function stealTownStock(
  state: GameState,
  townId: TownId,
): ItemPreviewDisplay[] {
  const town = state.world.towns[townId];
  const { stock } = town;
  if (stock.length === 0) return [];

  const maxSlots = Math.max(
    1,
    Math.floor(
      townShopItemCap(townId) * (RAID_LOSS_STOCK_MAX_STEAL_PERCENT / 100),
    ),
  );
  const stolenCount = Math.min(stock.length, rngNumberRange(1, maxSlots));
  const stolenEntries = rngShuffle(stock).slice(0, stolenCount);

  town.stock = town.stock.filter((entry) => !stolenEntries.includes(entry));

  return stolenEntries
    .map((entry) => townStockDisplay(entry))
    .filter((display): display is ItemPreviewDisplay => !!display);
}

// The whole queue is scrapped - materials already consumed for it are gone too, not refunded.
function cancelTownCraftQueue(
  state: GameState,
  townId: TownId,
): ItemPreviewDisplay[] {
  const town = state.world.towns[townId];
  const { craftQueue } = town;
  if (craftQueue.length === 0) return [];

  const displays = craftQueue
    .map((entry) => {
      const recipe = getEntry<RecipeContent>(entry.recipeId);
      return recipe ? resolveRewardDisplay(recipe.result) : undefined;
    })
    .filter((display): display is ItemPreviewDisplay => !!display);

  town.craftQueue = [];

  return displays;
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

function displayNamesHtml(displays: ItemPreviewDisplay[]): string {
  return displays
    .map(({ name, rarity }) => rarityNameHtml(name, rarity))
    .join(', ');
}

function logRaidLossMessages(
  townName: string,
  summary: TownRaidLossSummary,
): void {
  if (summary.stolenItems.length > 0) {
    categoryMessageLog(
      'Raid',
      townName,
      `${townName} lost the following items: ${displayNamesHtml(summary.stolenItems)}`,
    );
  }

  if (summary.cancelledCrafts.length > 0) {
    categoryMessageLog(
      'Raid',
      townName,
      `${townName} lost the following in-progress crafts: ${displayNamesHtml(summary.cancelledCrafts)}`,
    );
  }

  if (summary.lostMaterials.length > 0) {
    const descriptions = summary.lostMaterials.map(
      ({ item, quantity }) =>
        `${ITEM_ICON_TOKEN}${itemDropHtml(item, quantity)}`,
    );
    categoryMessageLog(
      'Raid',
      townName,
      `${townName} lost the following resources: ${descriptions.join(', ')}`,
      summary.lostMaterials.map(({ item }) => ({
        sprite: item.sprite,
        spritesheet: 'item',
      })),
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
      stolenItems: stealTownStock(state, townId),
      cancelledCrafts: cancelTownCraftQueue(state, townId),
      lostMaterials: stealTownMaterials(state, townId),
    };

    const target = state.world.towns[townId];
    target.lastRaidResolvedAtTick = now;
    target.craftSpeedDebuffExpiresAtTick = now + RAID_LOSS_CRAFT_DEBUFF_TICKS;
    raidTelegraphClear(state, townId, now);
    return state;
  });

  if (summary) logRaidLossMessages(town.name, summary);
}
