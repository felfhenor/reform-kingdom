import { getEntriesByType, getEntry } from '@helpers/content/content';
import { rngChoiceRarity } from '@helpers/rng';
import type {
  AffixContent,
  AffixEffect,
  AffixId,
  DropRarity,
  EquipmentItem,
} from '@interfaces';
import { AffixCountByRarity } from '@interfaces';
import { sumBy } from 'es-toolkit/compat';

// Item rarity controls how many affixes roll; each roll is independently weighted by the affix's own rarity, so a Common item can still land a rarer affix - it just gets fewer rolls overall.
// At most one Suffix-position affix total; Prefix affixes are otherwise uncapped.
export function rollAffixIds(rarity: DropRarity): AffixId[] {
  const pool = getEntriesByType<AffixContent>('affix');
  const rolledFamilies = new Set<string>();
  const rolledIds: AffixId[] = [];
  let hasRolledSuffix = false;

  for (let i = 0; i < AffixCountByRarity[rarity]; i++) {
    const eligible = pool.filter(
      (affix) =>
        !rolledFamilies.has(affix.family) &&
        !(hasRolledSuffix && affix.position === 'Suffix'),
    );
    const picked = rngChoiceRarity(eligible);
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
