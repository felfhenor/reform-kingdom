import { getEntry } from '@helpers/content/content';
import { affixEffectsOfKind } from '@helpers/item/affix';
import type {
  Character,
  EquipmentSkillId,
  JobId,
  TrainerTeachingContent,
  TrainerTeachingEffect,
  TrainerTeachingId,
} from '@interfaces';

// `?.` covers saves loaded before migration backfills the field.
export function characterTeachingIds(
  character: Pick<Character, 'teachings'>,
  jobId: JobId,
): TrainerTeachingId[] {
  return character.teachings?.[jobId] ?? [];
}

// Every job's teachings apply no matter the current job; one learned under several jobs stacks.
export function characterAllTeachingIds(
  character: Pick<Character, 'teachings'>,
): TrainerTeachingId[] {
  return Object.values(character.teachings ?? {}).flatMap(
    (teachingIds) => teachingIds ?? [],
  );
}

export function trainerTeachingEffects(
  teachingIds: TrainerTeachingId[],
): TrainerTeachingEffect[] {
  return teachingIds.flatMap(
    (teachingId) => getEntry<TrainerTeachingContent>(teachingId)?.effects ?? [],
  );
}

export function characterTeachingEffects(
  character: Pick<Character, 'teachings'>,
): TrainerTeachingEffect[] {
  return trainerTeachingEffects(characterAllTeachingIds(character));
}

export function trainerTeachingGrantedSkillIds(
  teachingIds: TrainerTeachingId[],
): EquipmentSkillId[] {
  return affixEffectsOfKind(
    trainerTeachingEffects(teachingIds),
    'GrantSkill',
  ).map((effect) => effect.skillId);
}
