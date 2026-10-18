import {
  characterAllTeachingIds,
  trainerTeachingEffects,
} from '@helpers/trainer/trainer-teaching';
import type { Character, HeroEffect } from '@interfaces';

// Gear is excluded: equipment totals already fold its affixes in.
export function characterNonGearEffects(
  character: Pick<Character, 'teachings' | 'debugEffects'>,
): HeroEffect[] {
  return [
    ...trainerTeachingEffects(characterAllTeachingIds(character)),
    ...(character.debugEffects ?? []),
  ];
}
