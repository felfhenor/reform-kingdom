import { ensureAffixEffect } from '@helpers/content/ensure-affix';
import {
  ensureArray,
  ensureCostItem,
} from '@helpers/content/ensure-helpers-core';
import {
  TrainerTeachingEffectKinds,
  type TrainerContent,
  type TrainerId,
  type TrainerTeachingContent,
  type TrainerTeachingEffect,
  type TrainerTeachingId,
} from '@interfaces';

function isTrainerTeachingEffect(effect: {
  kind: string;
}): effect is TrainerTeachingEffect {
  return TrainerTeachingEffectKinds.includes(
    effect.kind as TrainerTeachingEffect['kind'],
  );
}

export function ensureTrainer(
  trainer: Partial<TrainerContent>,
): Required<TrainerContent> {
  return {
    id: trainer.id ?? ('UNKNOWN' as TrainerId),
    name: trainer.name ?? 'UNKNOWN',
    __type: 'trainer',
    description: trainer.description ?? 'UNKNOWN',
    hidden: trainer.hidden ?? false,
    invisibleUntilCollectibleIdsFound:
      trainer.invisibleUntilCollectibleIdsFound ?? [],
    trainerTeachingIds: trainer.trainerTeachingIds ?? [],
  };
}

export function ensureTrainerTeaching(
  teaching: Partial<TrainerTeachingContent>,
): Required<TrainerTeachingContent> {
  return {
    id: teaching.id ?? ('UNKNOWN' as TrainerTeachingId),
    name: teaching.name ?? 'UNKNOWN',
    __type: 'trainerteaching',
    effects: ensureArray(
      (teaching.effects ?? []).filter(isTrainerTeachingEffect),
      ensureAffixEffect,
    ).filter(isTrainerTeachingEffect),
    requiredLevel: teaching.requiredLevel ?? 1,
    costs: ensureArray(teaching.costs, ensureCostItem),
    jobIds: teaching.jobIds ?? [],
    requiredCollectibleIds: teaching.requiredCollectibleIds ?? [],
    requiredTrainerTeachingIds: teaching.requiredTrainerTeachingIds ?? [],
  };
}
