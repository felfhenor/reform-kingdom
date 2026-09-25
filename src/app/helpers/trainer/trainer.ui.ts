import { miscellaneousMessageLog } from '@helpers/combat/combat-log';
import { getEntriesByType, getEntry } from '@helpers/content/content';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { notifySuccess } from '@helpers/engine/notify';
import { characterJobLevel } from '@helpers/hero/character-reclass';
import { getUnlockedJobs } from '@helpers/hero/job';
import { isCollectibleDiscovered } from '@helpers/item/collectibles';
import {
  affixEffectsBlock,
  COMBAT_STAT_BONUS,
  RESISTANCE_BONUS,
  STAT_BONUS,
} from '@helpers/item/equipment-bonus';
import { updateGamestate, worldPartyState } from '@helpers/state-game';
import {
  characterApplyTeaching,
  isPartyAtTrainer,
  isTrainerDiscovered,
  isTrainerTeachingLearned,
  trainerForTeaching,
  trainerTeachingAvailability,
  trainerTeachingMissingCollectibleIds,
  trainerTeachingsForJob,
} from '@helpers/trainer/trainer';
import {
  characterTeachingIds,
  trainerTeachingGrantedSkillIds,
} from '@helpers/trainer/trainer-teaching';
import {
  worldNodeCanAffordCost,
  worldNodeSpendCost,
} from '@helpers/world-node/world-node-cost';
import type {
  Character,
  CharacterId,
  CollectibleContent,
  EquipmentSkillContent,
  JobId,
  TrainerContent,
  TrainerTeachingContent,
  TrainerTeachingId,
  TrainerTeachingJobTab,
  TrainerTeachingPrerequisite,
  TrainerTeachingRow,
} from '@interfaces';
import { sortBy } from 'es-toolkit/compat';

const UNKNOWN_NAME = '???';

function teachingTrainerDisplayName(teachingId: TrainerTeachingId): string {
  const trainer = trainerForTeaching(teachingId);
  return trainer && isTrainerDiscovered(trainer.id)
    ? trainer.name
    : UNKNOWN_NAME;
}

// Level never hides a teaching - only an unvisited trainer or missing collectibles do.
function isTrainerTeachingRevealed(
  character: Character,
  teaching: TrainerTeachingContent,
  jobId: JobId,
): boolean {
  if (isTrainerTeachingLearned(character, teaching.id, jobId)) return true;

  const trainer = trainerForTeaching(teaching.id);
  return (
    !!trainer &&
    isTrainerDiscovered(trainer.id) &&
    trainerTeachingMissingCollectibleIds(teaching).length === 0
  );
}

function teachingGrantedSkills(
  teaching: TrainerTeachingContent,
): EquipmentSkillContent[] {
  return trainerTeachingGrantedSkillIds([teaching.id])
    .map((skillId) => getEntry<EquipmentSkillContent>(skillId))
    .filter((skill): skill is EquipmentSkillContent => !!skill);
}

// Same masking as the row's own name, so a prerequisite can't leak a hidden teaching.
function trainerTeachingPrerequisite(
  character: Character,
  teachingId: TrainerTeachingId,
  jobId: JobId,
): TrainerTeachingPrerequisite {
  const prerequisite = getEntry<TrainerTeachingContent>(teachingId);
  const isRevealed =
    !!prerequisite && isTrainerTeachingRevealed(character, prerequisite, jobId);

  return {
    name: isRevealed ? prerequisite.name : UNKNOWN_NAME,
    learned: isTrainerTeachingLearned(character, teachingId, jobId),
  };
}

// `jobId` is the job the row is viewed as - level, learned state and prerequisites are all per job.
export function trainerTeachingRow(
  character: Character,
  teaching: TrainerTeachingContent,
  jobId: JobId,
): TrainerTeachingRow {
  const isLearned = isTrainerTeachingLearned(character, teaching.id, jobId);
  const meetsLevel =
    characterJobLevel(character, jobId) >= teaching.requiredLevel;
  const collectibles = teaching.requiredCollectibleIds.map((collectibleId) => ({
    collectibleId,
    content: getEntry<CollectibleContent>(collectibleId),
    owned: isCollectibleDiscovered(collectibleId),
  }));

  const isRevealed = isTrainerTeachingRevealed(character, teaching, jobId);

  return {
    teaching,
    displayName: isRevealed ? teaching.name : UNKNOWN_NAME,
    isRevealed,
    trainerDisplayName: teachingTrainerDisplayName(teaching.id),
    availability: trainerTeachingAvailability(character, teaching, jobId),
    isLearned,
    meetsLevel,
    hasCollectibles: collectibles.every((entry) => entry.owned),
    canAfford: worldNodeCanAffordCost(teaching.costs),
    collectibles,
    prerequisites: teaching.requiredTrainerTeachingIds.map((teachingId) =>
      trainerTeachingPrerequisite(character, teachingId, jobId),
    ),
    stats: affixEffectsBlock(teaching.effects, STAT_BONUS),
    combatStats: affixEffectsBlock(teaching.effects, COMBAT_STAT_BONUS),
    resistances: affixEffectsBlock(teaching.effects, RESISTANCE_BONUS),
    grantedSkills: teachingGrantedSkills(teaching),
  };
}

function sortedRows(
  character: Character,
  teachings: TrainerTeachingContent[],
  jobId: JobId,
): TrainerTeachingRow[] {
  return sortBy(teachings, [
    (teaching) => teaching.requiredLevel,
    (teaching) => teaching.name,
  ]).map((teaching) => trainerTeachingRow(character, teaching, jobId));
}

// Training always happens as the hero's current job.
export function trainerVisitRows(
  trainer: TrainerContent,
  character: Character,
): TrainerTeachingRow[] {
  return sortedRows(
    character,
    trainerTeachingsForJob(trainer, character.jobId),
    character.jobId,
  );
}

function teachingsForJob(jobId: JobId): TrainerTeachingContent[] {
  return getEntriesByType<TrainerTeachingContent>('trainerteaching').filter(
    (teaching) => teaching.jobIds.includes(jobId),
  );
}

export function characterTeachingRows(
  character: Character,
  jobId: JobId,
): TrainerTeachingRow[] {
  return sortedRows(character, teachingsForJob(jobId), jobId);
}

export function characterTeachingJobTabs(
  character: Character,
): TrainerTeachingJobTab[] {
  return sortBy(getUnlockedJobs(), (job) => job.name).map((job) => {
    const teachings = teachingsForJob(job.id);
    const learnedIds = characterTeachingIds(character, job.id);

    return {
      job,
      learned: teachings.filter((teaching) => learnedIds.includes(teaching.id))
        .length,
      total: teachings.length,
    };
  });
}

// Re-validated inside the callback so a double-click can't learn (or pay for) the same teaching twice.
export async function trainerTeach(
  trainer: TrainerContent,
  characterId: CharacterId,
  teachingId: TrainerTeachingId,
): Promise<boolean> {
  const teaching = getEntry<TrainerTeachingContent>(teachingId);
  if (!teaching || !trainer.trainerTeachingIds.includes(teachingId))
    return false;
  if (!isPartyAtTrainer(trainer.id)) return false;

  const characterName = worldPartyState().find(
    (character) => character.id === characterId,
  )?.name;
  if (!characterName) return false;

  let learned = false;
  await updateGamestate((state) => {
    const character = state.world.party.find((c) => c.id === characterId);
    if (!character) return state;
    if (
      trainerTeachingAvailability(character, teaching, character.jobId) !==
      'Available'
    )
      return state;
    if (!worldNodeCanAffordCost(teaching.costs)) return state;

    worldNodeSpendCost(state, teaching.costs);
    characterApplyTeaching(character, teaching);
    learned = true;
    return state;
  });

  if (!learned) return false;

  notifySuccess(`${characterName} learned ${teaching.name}!`);
  miscellaneousMessageLog(
    `**${characterName}** learned **${teaching.name}** from **${trainer.name}**.`,
  );
  analyticsSendDesignEvent('Hero:Trainer:Teach');
  analyticsSendDesignEvent(
    `Hero:Trainer:Teach:${analyticsSafeSegment(teaching.name)}`,
  );
  return true;
}
