import {
  defaultCombatStats,
  defaultStats,
  defaultTagResistances,
} from '@helpers/defaults';
import type {
  CombatStatBlock,
  ItemPreviewDisplay,
  StatBlock,
  StatusEffectBlock,
} from '@interfaces';

function mergeBlock<T extends Record<string, number>>(
  base: T,
  bonus: T | undefined,
): T {
  const total = { ...base };
  (Object.keys(total) as (keyof T)[]).forEach((key) => {
    total[key] = (total[key] + (bonus?.[key] ?? 0)) as T[keyof T];
  });

  return total;
}

// Base+bonus totals, used as the OTHER column's comparison baseline in the equip-picker.
export function itemPreviewTotalStats(display: ItemPreviewDisplay): StatBlock {
  return mergeBlock(display.stats ?? defaultStats(), display.bonusStats);
}

export function itemPreviewTotalResistances(
  display: ItemPreviewDisplay,
): StatusEffectBlock {
  return mergeBlock(
    display.resistances ?? defaultTagResistances(),
    display.bonusResistances,
  );
}

export function itemPreviewTotalCombatStats(
  display: ItemPreviewDisplay,
): CombatStatBlock {
  return mergeBlock(
    display.combatStats ?? defaultCombatStats(),
    display.bonusCombatStats,
  );
}
