import { getEntriesByType, getEntry } from '@helpers/content/content';
import { characterStatsForLevel } from '@helpers/hero/party';
import { isCollectibleDiscovered } from '@helpers/item/collectibles';
import { discoveredTrainersState, updateGamestate } from '@helpers/state-game';
import { characterJobLevel } from '@helpers/hero/character-reclass';
import {
  characterAllTeachingIds,
  characterTeachingIds,
} from '@helpers/trainer/trainer-teaching';
import { worldNodeAtCurrentLocation } from '@helpers/world';
import { worldNodeTrainer } from '@helpers/world-node/world-nodes';
import type {
  Character,
  CollectibleId,
  GameStateDiscoveredTrainers,
  JobContent,
  JobId,
  TrainerContent,
  TrainerId,
  TrainerTeachingAvailability,
  TrainerTeachingContent,
  TrainerTeachingId,
} from '@interfaces';
import { clamp, uniq } from 'es-toolkit/compat';

export function trainerTeachings(
  trainer: TrainerContent,
): TrainerTeachingContent[] {
  return trainer.trainerTeachingIds
    .map((teachingId) => getEntry<TrainerTeachingContent>(teachingId))
    .filter((teaching): teaching is TrainerTeachingContent => !!teaching);
}

export function trainerTeachingsForJob(
  trainer: TrainerContent,
  jobId: JobId,
): TrainerTeachingContent[] {
  return trainerTeachings(trainer).filter((teaching) =>
    teaching.jobIds.includes(jobId),
  );
}

// Each teaching is expected to belong to exactly one trainer (enforced by validation, not here).
export function trainerForTeaching(
  teachingId: TrainerTeachingId,
): TrainerContent | undefined {
  return getEntriesByType<TrainerContent>('trainer').find((trainer) =>
    trainer.trainerTeachingIds.includes(teachingId),
  );
}

export function isTrainerTeachingLearned(
  character: Character,
  teachingId: TrainerTeachingId,
  jobId: JobId,
): boolean {
  return characterTeachingIds(character, jobId).includes(teachingId);
}

export function trainerTeachingMissingCollectibleIds(
  teaching: TrainerTeachingContent,
): CollectibleId[] {
  return teaching.requiredCollectibleIds.filter(
    (collectibleId) => !isCollectibleDiscovered(collectibleId),
  );
}

// Prerequisites still have to be learned under the same job, since purchases are per job.
export function trainerTeachingMissingPrerequisiteIds(
  character: Character,
  teaching: TrainerTeachingContent,
  jobId: JobId,
): TrainerTeachingId[] {
  return teaching.requiredTrainerTeachingIds.filter(
    (teachingId) => !isTrainerTeachingLearned(character, teachingId, jobId),
  );
}

// Ignores cost - "could this hero learn it as `jobId`", not "can the player pay for it". Uses the hero's level in that job.
export function trainerTeachingAvailability(
  character: Character,
  teaching: TrainerTeachingContent,
  jobId: JobId,
): TrainerTeachingAvailability {
  if (isTrainerTeachingLearned(character, teaching.id, jobId)) return 'Learned';
  if (!teaching.jobIds.includes(jobId)) return 'WrongJob';
  if (characterJobLevel(character, jobId) < teaching.requiredLevel)
    return 'LevelTooLow';
  if (
    trainerTeachingMissingPrerequisiteIds(character, teaching, jobId).length > 0
  )
    return 'MissingPrerequisites';
  if (trainerTeachingMissingCollectibleIds(teaching).length > 0)
    return 'MissingCollectibles';
  return 'Available';
}

export function isPartyAtTrainer(trainerId: TrainerId): boolean {
  const entry = worldNodeAtCurrentLocation();
  return !!entry && worldNodeTrainer(entry)?.id === trainerId;
}

export function isTrainerDiscovered(trainerId: TrainerId): boolean {
  return !!discoveredTrainersState()[trainerId]?.foundAt;
}

export function isAnyTrainerDiscovered(): boolean {
  return Object.keys(discoveredTrainersState()).length > 0;
}

export function trainerMarkDiscovered(trainerId: TrainerId): void {
  if (isTrainerDiscovered(trainerId)) return;

  updateGamestate((state) => {
    state.discoveredTrainers[trainerId] = { foundAt: Date.now() };
    return state;
  });
}

// Mutates `character` in place - call only on an `updateGamestate` draft. Learned under the current job; Health/Energy gains top up current hp/ep too.
export function characterApplyTeaching(
  character: Character,
  teaching: TrainerTeachingContent,
): void {
  character.teachings ??= {};
  character.teachings[character.jobId] = [
    ...characterTeachingIds(character, character.jobId),
    teaching.id,
  ];

  const stats = characterStatsForLevel(
    character.jobId,
    character.level,
    character.equipment,
    characterAllTeachingIds(character),
  );
  const healthGain = stats.Health - character.stats.Health;
  const energyGain = stats.Energy - character.stats.Energy;

  character.stats = stats;
  character.hp = clamp(character.hp + healthGain, 0, stats.Health);
  character.ep = clamp(character.ep + energyGain, 0, stats.Energy);
}

export function pruneInvalidDiscoveredTrainers(
  discovered: GameStateDiscoveredTrainers,
): GameStateDiscoveredTrainers {
  const pruned: GameStateDiscoveredTrainers = {};

  (Object.keys(discovered) as TrainerId[]).forEach((trainerId) => {
    if (getEntry<TrainerContent>(trainerId)) {
      pruned[trainerId] = discovered[trainerId];
    }
  });

  return pruned;
}

// Drops removed jobs/teachings and duplicates; a teaching no longer offered to a job is kept, since it was already paid for.
export function pruneInvalidCharacterTeachings(
  teachings: Character['teachings'] | undefined,
): Character['teachings'] {
  const pruned: Character['teachings'] = {};

  (Object.keys(teachings ?? {}) as JobId[]).forEach((jobId) => {
    if (!getEntry<JobContent>(jobId)) return;

    const valid = uniq(teachings?.[jobId] ?? []).filter(
      (teachingId) => !!getEntry<TrainerTeachingContent>(teachingId),
    );
    if (valid.length > 0) pruned[jobId] = valid;
  });

  return pruned;
}
