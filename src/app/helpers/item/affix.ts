import { getEntriesByType, getEntry } from '@helpers/content/content';
import { rngChoiceWeighted } from '@helpers/rng';
import type {
  AffixContent,
  AffixEffect,
  AffixId,
  DropRarity,
  EquipmentContent,
  EquipmentItem,
} from '@interfaces';
import { AffixCountByRarity, EquipmentTypeToSlot } from '@interfaces';
import { sumBy } from 'es-toolkit/compat';

export const AFFIX_ROLL_WEIGHT_BY_RARITY: Record<DropRarity, number> = {
  Common: 25,
  Uncommon: 15,
  Rare: 5,
  Mystical: 3,
  Legendary: 1,
};

// At drop weights a specific Legendary chase takes ~1700 reforges, so reforges boost flux-only affixes.
export const FLUX_ONLY_AFFIX_WEIGHT_BY_RARITY: Record<DropRarity, number> = {
  ...AFFIX_ROLL_WEIGHT_BY_RARITY,
  Mystical: 15,
  Legendary: 5,
};

export function affixMatchesEquipment(
  affix: AffixContent,
  content: EquipmentContent,
): boolean {
  if (affix.gearSlots.length === 0 && affix.gearTypes.length === 0) {
    return true;
  }

  return (
    affix.gearTypes.includes(content.type) ||
    EquipmentTypeToSlot[content.type].some((slot) =>
      affix.gearSlots.includes(slot),
    )
  );
}

// itemLevel gating applies to reforges too - it's what paces affix power with progression.
export function affixCanRollOn(
  affix: AffixContent,
  content: EquipmentContent,
  isReforge: boolean,
): boolean {
  return (
    affix.levelRequirement <= content.levelRequirement &&
    (isReforge || !affix.fluxOnly) &&
    affixMatchesEquipment(affix, content)
  );
}

export function affixRollWeight(
  affix: AffixContent,
  isReforge: boolean,
): number {
  return isReforge && affix.fluxOnly
    ? FLUX_ONLY_AFFIX_WEIGHT_BY_RARITY[affix.rarity]
    : AFFIX_ROLL_WEIGHT_BY_RARITY[affix.rarity];
}

// Item rarity controls how many affixes roll; each roll is independently weighted by the affix's own rarity, so a Common item can still land a rarer affix - it just gets fewer rolls overall.
// At most one Suffix-position affix total; Prefix affixes are otherwise uncapped.
export function rollAffixIds(
  content: EquipmentContent,
  isReforge = false,
): AffixId[] {
  const pool = getEntriesByType<AffixContent>('affix').filter((affix) =>
    affixCanRollOn(affix, content, isReforge),
  );
  const rolledFamilies = new Set<string>();
  const rolledIds: AffixId[] = [];
  let hasRolledSuffix = false;

  for (let i = 0; i < AffixCountByRarity[content.rarity]; i++) {
    const eligible = pool.filter(
      (affix) =>
        !rolledFamilies.has(affix.family) &&
        !(hasRolledSuffix && affix.position === 'Suffix'),
    );
    const picked = rngChoiceWeighted(eligible, (affix) =>
      affixRollWeight(affix, isReforge),
    );
    if (!picked) break;

    if (picked.position === 'Suffix') hasRolledSuffix = true;

    rolledFamilies.add(picked.family);
    rolledIds.push(picked.id);
  }

  return rolledIds;
}

export function equipmentItemAffixes(item: EquipmentItem): AffixContent[] {
  return item.affixIds
    .map((affixId) => getEntry<AffixContent>(affixId))
    .filter((affix): affix is AffixContent => !!affix);
}

// Each affix can carry multiple effects.
export function equipmentItemAffixEffects(item: EquipmentItem): AffixEffect[] {
  return equipmentItemAffixes(item).flatMap((affix) => affix.effects);
}

// Composes prefixes before and suffixes after the base name, e.g. "Weakening" + "Copper Ring" + "of Strength" -> "Weakening Copper Ring of Strength".
export function equipmentItemDisplayName(
  item: EquipmentItem,
  baseName: string,
): string {
  const affixes = equipmentItemAffixes(item);
  const prefixNames = affixes
    .filter((affix) => affix.position === 'Prefix')
    .map((affix) => affix.name);
  const suffixNames = affixes
    .filter((affix) => affix.position === 'Suffix')
    .map((affix) => affix.name);

  return [...prefixNames, baseName, ...suffixNames].join(' ');
}

// Effect kinds already shown elsewhere in item UI (stat/resistance/combat-stat/monster-type-damage/elemental blocks, granted-skill list, infusion slot count, armory sell value, gather yield/skill stat bonus rows) - their affix's own description would be redundant.
const AFFIX_KINDS_WITH_OWN_DISPLAY = new Set<AffixEffect['kind']>([
  'Stat',
  'CombatStat',
  'Resistance',
  'GrantSkill',
  'InfusionSlot',
  'SellValue',
  'MonsterTypeDamage',
  'ElementalResistance',
  'ElementalBoon',
  'GatherYield',
  'SkillStatBonus',
]);

// Affix descriptions for effects with no dedicated display elsewhere (caravan discounts) - shown as plain text in the item tooltip.
export function equipmentItemMiscAffixDescriptions(
  item: EquipmentItem,
): string[] {
  return equipmentItemAffixes(item)
    .filter((affix) =>
      affix.effects.some(
        (effect) => !AFFIX_KINDS_WITH_OWN_DISPLAY.has(effect.kind),
      ),
    )
    .map((affix) => affix.description);
}

// The "narrow to one effect kind" primitive every stat/resistance/slot/sell/yield/caravan/skill resolver was reimplementing inline.
export function affixEffectsOfKind<K extends AffixEffect['kind']>(
  effects: AffixEffect[],
  kind: K,
): Extract<AffixEffect, { kind: K }>[] {
  return effects.filter(
    (effect): effect is Extract<AffixEffect, { kind: K }> =>
      effect.kind === kind,
  );
}

// Sums `.value` across effects of one kind, optionally narrowed further (e.g. by which stat/tag/tradeskill matches).
export function affixEffectSum<K extends AffixEffect['kind']>(
  effects: AffixEffect[],
  kind: K,
  matches?: (effect: Extract<AffixEffect, { kind: K }>) => boolean,
): number {
  const matching = affixEffectsOfKind(effects, kind);
  return sumBy(matches ? matching.filter(matches) : matching, (effect) =>
    'value' in effect ? effect.value : 0,
  );
}
