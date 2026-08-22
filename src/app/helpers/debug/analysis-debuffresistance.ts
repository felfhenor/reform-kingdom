/**
 * Reports on the debuff-resistance tag system: which status effects belong
 * to each tag family, which equipment/items grant resistance to each tag
 * and how much, and whether any tag has a level-window with no gear
 * granting resistance to it. Ported from `scripts/analyze-debuffresistance.ts`.
 */

import { sortBy } from 'es-toolkit/compat';
import { getEntriesByType } from '@helpers/content';
import { formatWindows, gapWindows } from '@helpers/debug/analysis-utils';
import type {
  AnalysisCheck,
  AnalysisParams,
  AnalysisRunResult,
  EquipmentContent,
  ItemContent,
  StatusEffectContent,
  StatusEffectTag,
} from '@interfaces';

// Keep in sync with `StatusEffectTag` in `src/app/interfaces/content-statuseffect.ts`.
const ALL_STATUS_EFFECT_TAGS: StatusEffectTag[] = [
  'Stun',
  'StatDown',
  'Accuracy',
  'DamageOverTime',
  'Poison',
  'Burn',
];

export function runDebuffResistanceAnalysis(
  params: AnalysisParams,
): AnalysisRunResult {
  const gapSize = Number(params['gap'] ?? 4);
  if (!Number.isInteger(gapSize) || gapSize < 1) {
    throw new Error(`"gap" must be a positive integer, got ${params['gap']}.`);
  }

  const statusEffects = getEntriesByType<StatusEffectContent>('statuseffect');
  const equipment = getEntriesByType<EquipmentContent>('equipment');
  const items = getEntriesByType<ItemContent>('item');

  const obtainableEquipment = equipment.filter((e) => !e.unobtainable);
  const derivedMaxLevel = Math.max(
    0,
    ...obtainableEquipment.map((e) => e.levelRequirement ?? 0),
  );
  const maxContentLevel =
    params['level'] !== undefined ? Number(params['level']) : derivedMaxLevel;

  const checks: AnalysisCheck[] = [];

  ALL_STATUS_EFFECT_TAGS.forEach((tag) => {
    const members = statusEffects.filter((effect) => effect.tags.includes(tag));
    checks.push({
      id: `tag-family:${tag}`,
      label: `Tag family: ${tag}`,
      status: 'info',
      message:
        members.length === 0
          ? `${tag}: no status effects carry this tag.`
          : `${tag}: ${members.map((e) => e.name).join(', ')}`,
    });
  });

  ALL_STATUS_EFFECT_TAGS.forEach((tag) => {
    const equipmentSources = sortBy(
      obtainableEquipment.filter((e) => (e.debuffResistances?.[tag] ?? 0) !== 0),
      [(e: EquipmentContent) => e.levelRequirement ?? 0],
    );
    const itemSources = items.filter(
      (i) => (i.infusionDebuffResistances?.[tag] ?? 0) !== 0,
    );

    const lines = [
      ...equipmentSources.map(
        (e) =>
          `Lv${e.levelRequirement} ${e.name} (equipment): +${e.debuffResistances?.[tag]}%`,
      ),
      ...itemSources.map(
        (i) =>
          `${i.name} (infusion item): +${i.infusionDebuffResistances?.[tag]}%`,
      ),
    ];

    checks.push({
      id: `resistance-source:${tag}`,
      label: `Resistance sources: ${tag}`,
      status: 'info',
      message:
        lines.length === 0
          ? `${tag}: no equipment or items grant this resistance.`
          : `${tag}: ${lines.join('; ')}`,
    });
  });

  ALL_STATUS_EFFECT_TAGS.forEach((tag) => {
    const levels = obtainableEquipment
      .filter((e) => (e.debuffResistances?.[tag] ?? 0) !== 0)
      .map((e) => e.levelRequirement);

    if (levels.length === 0) {
      checks.push({
        id: `resistance-coverage:${tag}`,
        label: `Resistance coverage: ${tag}`,
        status: 'warning',
        message: `Tag "${tag}" has no equipment granting resistance to it at any level.`,
      });
      return;
    }

    const windows = gapWindows(levels, maxContentLevel, gapSize);
    checks.push(
      windows.length > 0
        ? {
            id: `resistance-coverage:${tag}`,
            label: `Resistance coverage: ${tag}`,
            status: 'warning',
            message: `Tag "${tag}" has no resistance-granting equipment at level window(s): ${formatWindows(windows)} (checked 1..${maxContentLevel}, ${levels.length} item(s) total).`,
          }
        : {
            id: `resistance-coverage:${tag}`,
            label: `Resistance coverage: ${tag}`,
            status: 'pass',
            message: `${tag}: levels 1..${maxContentLevel} all have at least one resistance-granting item (${levels.length} item(s) total).`,
          },
    );
  });

  const warnings = checks.filter((c) => c.status === 'warning').length;

  return {
    checks,
    summary:
      warnings === 0
        ? 'No coverage gaps found.'
        : `${warnings} coverage gap warning(s) found.`,
  };
}
