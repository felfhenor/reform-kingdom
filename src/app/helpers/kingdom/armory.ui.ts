import { getEntry } from '@helpers/content/content';
import { analyticsSendDesignEvent } from '@helpers/engine/analytics';
import { equipmentItemAffixes } from '@helpers/item/affix';
import { itemPreviewDisplay } from '@helpers/item/item-preview';
import { gainGold, goldCoinId } from '@helpers/item/materials';
import {
  tradeEquipmentItemLogPart,
  tradeGoodsLogPart,
  tradeLog,
} from '@helpers/item/trade';
import { armoryEntriesFor, equipmentSellValue } from '@helpers/kingdom/armory';
import {
  armoryWarningTier,
  syncArmoryGlobalEffects,
} from '@helpers/kingdom/armory-global-effects';
import { updateGamestate } from '@helpers/state-game';
import {
  CombatStatDimension,
  ElementBoonDimension,
  ElementResistanceDimension,
  EquipmentTypeToSlot,
  MonsterTypeDimension,
  StatDimension,
  StatusEffectTagDimension,
  type AdventureLogRewardPart,
  type ArmoryFillColor,
  type ArmoryWarningTier,
  type EquipmentArmoryEntry,
  type EquipmentItemId,
  type ItemContent,
  type ItemPreviewDisplay,
  type StatDisplayDimension,
} from '@interfaces';
import { sum } from 'es-toolkit/compat';

// Matches each warning effect's icon tint.
const ARMORY_TIER_FILL_COLOR: Record<ArmoryWarningTier, ArmoryFillColor> = {
  Encumbered: 'success',
  Overburdened: 'warning',
  'Over Capacity': 'error',
};

// Literal class names so Tailwind's scanner picks them up.
const ARMORY_BADGE_CLASS: Record<ArmoryFillColor, string> = {
  muted: 'badge-data',
  success: 'badge-success',
  warning: 'badge-warning',
  error: 'badge-error',
};

const ARMORY_STATUS_DOT_CLASS: Record<ArmoryFillColor, string | undefined> = {
  muted: undefined,
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-error',
};

export function armoryFillColor(
  armorySize: number,
  cap: number,
): ArmoryFillColor {
  const tier = armoryWarningTier(armorySize, cap);
  return tier ? ARMORY_TIER_FILL_COLOR[tier] : 'muted';
}

export function armoryBadgeClass(armorySize: number, cap: number): string {
  return ARMORY_BADGE_CLASS[armoryFillColor(armorySize, cap)];
}

export function armoryStatusDotClass(
  armorySize: number,
  cap: number,
): string | undefined {
  return ARMORY_STATUS_DOT_CLASS[armoryFillColor(armorySize, cap)];
}

function nonZeroLabels<K extends string>(
  dimension: StatDisplayDimension<K>,
  ...blocks: (Partial<Record<K, number>> | undefined)[]
): string[] {
  return dimension.order
    .filter((key) => blocks.some((block) => (block?.[key] ?? 0) !== 0))
    .map((key) => dimension.label[key]);
}

function previewBlockLabels(preview: ItemPreviewDisplay): string[] {
  return [
    ...nonZeroLabels(StatDimension, preview.stats, preview.bonusStats),
    ...nonZeroLabels(
      StatusEffectTagDimension,
      preview.resistances,
      preview.bonusResistances,
    ),
    ...nonZeroLabels(
      CombatStatDimension,
      preview.combatStats,
      preview.bonusCombatStats,
    ),
    ...nonZeroLabels(
      MonsterTypeDimension,
      preview.monsterTypeDamage,
      preview.bonusMonsterTypeDamage,
    ),
    ...nonZeroLabels(
      ElementResistanceDimension,
      preview.elementalResistances,
      preview.bonusElementalResistances,
    ),
    ...nonZeroLabels(
      ElementBoonDimension,
      preview.elementalBoons,
      preview.bonusElementalBoons,
    ),
  ];
}

function previewListTerms(preview: ItemPreviewDisplay): string[] {
  return [
    ...(preview.skills ?? []).map((skill) => skill.name),
    ...(preview.gatherYieldBonuses ?? []).map((bonus) => bonus.tradeskillName),
    ...(preview.skillStatBonuses ?? []).flatMap((bonus) => [
      bonus.skillName,
      bonus.stat,
    ]),
    ...(preview.elements ?? []),
  ];
}

// Built from the tooltip model so ids (tradeskills, skills) are already resolved to display names.
function armoryEntrySearchText(entry: EquipmentArmoryEntry): string {
  const preview = itemPreviewDisplay('equipment', entry.content, entry.item);
  const infusionNames = entry.item.infusedItemIds
    .map((itemId) => (itemId ? getEntry<ItemContent>(itemId)?.name : undefined))
    .filter((name): name is string => !!name);

  return [
    preview.name,
    preview.description,
    preview.rarity,
    entry.content.type,
    ...EquipmentTypeToSlot[entry.content.type],
    ...previewBlockLabels(preview),
    ...previewListTerms(preview),
    ...equipmentItemAffixes(entry.item).map((affix) => affix.description),
    ...infusionNames,
  ]
    .join(' ')
    .toLowerCase();
}

export function filterArmoryEntries(
  entries: EquipmentArmoryEntry[],
  searchText: string,
): EquipmentArmoryEntry[] {
  const words = searchText.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return entries;

  return entries.filter((entry) => {
    const text = armoryEntrySearchText(entry);
    return words.every((word) => text.includes(word));
  });
}

function armorySoldLogPart(
  entries: EquipmentArmoryEntry[],
): AdventureLogRewardPart | undefined {
  if (entries.length === 1) {
    return tradeEquipmentItemLogPart(entries[0].item);
  }
  return { html: `${entries.length.toLocaleString()} pieces of equipment` };
}

// Sells owned armory items atomically; stale ids are silently skipped. Returns total gold gained.
export async function sellEquipmentItems(
  equipmentItemIds: EquipmentItemId[],
): Promise<number> {
  const idsToSell = new Set(equipmentItemIds);
  let soldCount = 0;
  let soldPart: AdventureLogRewardPart | undefined;
  let totalGold = 0;

  await updateGamestate((state) => {
    const sold = armoryEntriesFor(
      state.armory.filter((item) => idsToSell.has(item.id)),
    );
    if (sold.length === 0) return state;

    soldCount = sold.length;
    soldPart = armorySoldLogPart(sold);
    totalGold = sum(sold.map((entry) => equipmentSellValue(entry)));
    state.armory = state.armory.filter((item) => !idsToSell.has(item.id));
    syncArmoryGlobalEffects(state);
    gainGold(state, totalGold);
    return state;
  });
  if (soldCount === 0) return 0;

  tradeLog(
    'Miscellaneous',
    'sold',
    [soldPart],
    [tradeGoodsLogPart({ itemId: goldCoinId() }, totalGold)],
  );
  analyticsSendDesignEvent('Kingdom:Armory:MassSell', soldCount);
  return totalGold;
}
