import { affixEffectsOfKind } from '@helpers/item/affix';
import {
  characterAllTeachingIds,
  trainerTeachingEffects,
} from '@helpers/trainer/trainer-teaching';
import type { Character, DebuffPotency, HeroEffect } from '@interfaces';
import { sumBy } from 'es-toolkit/compat';

// Gear is excluded: equipment totals already fold its affixes in.
export function characterNonGearEffects(
  character: Pick<Character, 'teachings' | 'debugEffects'>,
): HeroEffect[] {
  return [
    ...trainerTeachingEffects(characterAllTeachingIds(character)),
    ...(character.debugEffects ?? []),
  ];
}

export function characterDebuffPotency(
  character: Pick<Character, 'teachings' | 'debugEffects'>,
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
