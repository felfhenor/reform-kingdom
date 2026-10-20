import { skillTreeNodeEffects } from '@helpers/hero/skill-tree-content';
import { affixEffectsOfKind } from '@helpers/item/affix';
import {
  characterAllTeachingIds,
  trainerTeachingEffects,
} from '@helpers/trainer/trainer-teaching';
import type { Character, DebuffPotency, HeroEffect } from '@interfaces';
import { sumBy } from 'es-toolkit/compat';

// Gear is excluded: equipment totals already fold its affixes in. Only the current job's tree applies.
export function characterNonGearEffects(
  character: Pick<Character, 'jobId' | 'teachings' | 'skillTreeNodes'>,
): HeroEffect[] {
  return [
    ...trainerTeachingEffects(characterAllTeachingIds(character)),
    ...skillTreeNodeEffects(character.skillTreeNodes?.[character.jobId] ?? []),
  ];
}

export function characterDebuffPotency(
  character: Pick<Character, 'jobId' | 'teachings' | 'skillTreeNodes'>,
): DebuffPotency {
  const effects = affixEffectsOfKind(
    characterNonGearEffects(character),
    'DebuffPotency',
  );

  return {
    chance: sumBy(effects, (effect) => effect.chance),
    duration: sumBy(effects, (effect) => effect.duration),
  };
}
