import {
  CombatStatDimension,
  ElementBoonDimension,
  ElementResistanceDimension,
  MonsterTypeDimension,
  StatDimension,
  StatusEffectTagDimension,
} from '@helpers/hero/stat-dimension';
import {
  type ItemPreviewDisplay,
  type StatDisplayDimension,
} from '@interfaces';

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
export function itemPreviewSearchTerms(preview: ItemPreviewDisplay): string[] {
  return [
    preview.name,
    preview.description,
    preview.rarity,
    ...previewBlockLabels(preview),
    ...previewListTerms(preview),
  ];
}

// Every typed word must appear somewhere in the entry's text, in any order.
export function filterBySearchWords<T>(
  entries: T[],
  searchText: string,
  entryText: (entry: T) => string,
): T[] {
  const words = searchText.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return entries;

  return entries.filter((entry) => {
    const text = entryText(entry).toLowerCase();
    return words.every((word) => text.includes(word));
  });
}
