// Human-readable text for a single node's own ResearchEffect - shown in the
// research node tooltip. Takes a `formatValue` callback rather than
// formatting numbers itself, since this is a plain helper (no Angular DI
// context to pull LOCALE_ID from) - callers use Angular's formatNumber, per
// the number-formatting rule, and tests can pass String()/an identity fn.
import { getEntry } from '@helpers/content';
import type { ItemContent, ResearchEffect } from '@interfaces';

export function researchEffectDescription(
  effect: ResearchEffect,
  formatValue: (value: number) => string,
): string {
  switch (effect.type) {
    case 'TravelTimeReduction':
      return `${formatValue(effect.percent)}% reduced travel time.`;
    case 'CaravanPriceReduction':
      return `${formatValue(effect.percent)}% lower prices when buying from caravans.`;
    case 'AstralSpellDurationIncrease':
      return `${formatValue(effect.percent)}% longer Astral Projector spell duration.`;
    case 'ArmorySellValueIncrease':
      return `${formatValue(effect.percent)}% higher Armory sell values.`;
    case 'PostWipeHealTimeReduction':
      return `${formatValue(effect.percent)}% faster recovery after a wipe.`;
    case 'MonsterLootBonusQuantity':
      return `+${formatValue(effect.bonusQuantity)} extra item(s) from every monster kill.`;
    case 'GatherBonusQuantityChance':
      return `${formatValue(effect.chance)}% chance to gather ${formatValue(effect.bonusQuantity)} extra item(s).`;
    case 'MonsterBonusGoldChance':
      return `${formatValue(effect.chance)}% chance to find ${formatValue(effect.bonusGold)} bonus gold from monster kills.`;
    case 'CraftBonusXpChance':
      return `${formatValue(effect.chance)}% chance to gain ${formatValue(effect.bonusXp)} bonus tradeskill XP when crafting.`;
    case 'CraftBonusXpChanceIncrease':
      return `+${formatValue(effect.chance)}% chance to that bonus XP proc.`;
    case 'CraftBonusXpAmountIncrease':
      return `+${formatValue(effect.bonusXp)} to that bonus XP amount.`;
    case 'MaterialAutomation': {
      const itemName = getEntry<ItemContent>(effect.itemId)?.name ?? 'Unknown';
      return `Automatically grants ${formatValue(effect.quantityPerGrant)} ${itemName} every ${formatValue(effect.ticksPerGrant)} ticks.`;
    }
  }
}
