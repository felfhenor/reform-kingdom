/**
 * Validates trainer content: every trainer is placed on a map exactly once as a
 * `Trainer` node, every teaching is allocated to exactly one trainer, and each
 * teaching's jobs, costs, effects, collectibles and prerequisite chain are
 * actually satisfiable.
 */

import { CHARACTER_MAX_LEVEL } from '@helpers/config';
import { getEntriesByType, getEntry } from '@helpers/content/content';
import { allMaps } from '@helpers/maps';
import type {
  AnalysisCheck,
  AnalysisRunResult,
  CollectibleContent,
  EquipmentSkillContent,
  ItemContent,
  JobContent,
  TiledMap,
  TrainerContent,
  TrainerTeachingContent,
  TrainerTeachingId,
} from '@interfaces';

function trainerMapPlacements(trainerName: string): string[] {
  const placements: string[] = [];

  allMaps().forEach((gameMap) => {
    (gameMap.data as TiledMap).layers.forEach((layer) => {
      (layer.objects ?? []).forEach((object) => {
        if (object.type === 'Trainer' && object.name === trainerName) {
          placements.push(gameMap.name);
        }
      });
    });
  });

  return placements;
}

function unnamedTrainerNodeChecks(): AnalysisCheck[] {
  const checks: AnalysisCheck[] = [];

  allMaps().forEach((gameMap) => {
    (gameMap.data as TiledMap).layers.forEach((layer) => {
      (layer.objects ?? []).forEach((object) => {
        if (object.type !== 'Trainer' || object.name) return;

        checks.push({
          id: `trainers:unnamed:${gameMap.name}:${object.id}`,
          label: `Unnamed trainer on ${gameMap.name}`,
          status: 'fail',
          message: `A Trainer node on "${gameMap.name}" (object id ${object.id}, ${object.x}, ${object.y}) has no name, so it can't resolve to any trainer.`,
        });
      });
    });
  });

  return checks;
}

function trainerProblems(trainer: TrainerContent): string[] {
  const problems: string[] = [];

  const placements = trainerMapPlacements(trainer.name);
  if (placements.length === 0) problems.push('is not placed on any map');
  if (placements.length > 1) {
    problems.push(
      `is placed ${placements.length} times (${placements.join(', ')})`,
    );
  }

  if (trainer.trainerTeachingIds.length === 0) problems.push('teaches nothing');
  trainer.trainerTeachingIds.forEach((teachingId) => {
    if (!getEntry<TrainerTeachingContent>(teachingId)) {
      problems.push(`lists unknown teaching "${teachingId}"`);
    }
  });

  return problems;
}

function allocationProblems(
  teaching: TrainerTeachingContent,
  trainers: TrainerContent[],
): string[] {
  const owners = trainers.filter((trainer) =>
    trainer.trainerTeachingIds.includes(teaching.id),
  );

  if (owners.length === 0) {
    return [
      "is not allocated to any trainer - add it to a trainer's trainerTeachingIds",
    ];
  }

  if (owners.length > 1) {
    const names = owners.map((trainer) => trainer.name).join(', ');
    return [
      `is taught by ${owners.length} trainers (${names}); the Teachings list can only name one`,
    ];
  }

  return [];
}

function referenceProblems(teaching: TrainerTeachingContent): string[] {
  const problems: string[] = [];

  if (teaching.jobIds.length === 0) problems.push('has no jobIds');
  teaching.jobIds.forEach((jobId) => {
    if (!getEntry<JobContent>(jobId))
      problems.push(`has unknown job "${jobId}"`);
  });

  teaching.requiredCollectibleIds.forEach((collectibleId) => {
    if (!getEntry<CollectibleContent>(collectibleId)) {
      problems.push(`requires unknown collectible "${collectibleId}"`);
    }
  });

  if (teaching.costs.length === 0) problems.push('costs nothing');
  teaching.costs.forEach((cost) => {
    if (!getEntry<ItemContent>(cost.itemId))
      problems.push(`costs unknown item "${cost.itemId}"`);
    if (cost.required <= 0)
      problems.push(`has a non-positive cost for "${cost.itemId}"`);
  });

  return problems;
}

function effectProblems(teaching: TrainerTeachingContent): string[] {
  const problems: string[] = [];

  if (teaching.effects.length === 0) problems.push('has no effects');
  teaching.effects.forEach((effect) => {
    if (effect.kind === 'GrantSkill') {
      if (!getEntry<EquipmentSkillContent>(effect.skillId)) {
        problems.push(`grants unknown skill "${effect.skillId}"`);
      }
      return;
    }

    if (effect.value === 0)
      problems.push(`has a zero-value ${effect.kind} effect`);
  });

  if (
    teaching.requiredLevel < 1 ||
    teaching.requiredLevel > CHARACTER_MAX_LEVEL
  ) {
    problems.push(
      `requires level ${teaching.requiredLevel}, outside 1-${CHARACTER_MAX_LEVEL}`,
    );
  }

  return problems;
}

function prerequisiteChainHasCycle(
  teaching: TrainerTeachingContent,
  visiting = new Set<TrainerTeachingId>(),
): boolean {
  if (visiting.has(teaching.id)) return true;
  visiting.add(teaching.id);

  const hasCycle = teaching.requiredTrainerTeachingIds.some(
    (prerequisiteId) => {
      const prerequisite = getEntry<TrainerTeachingContent>(prerequisiteId);
      return (
        !!prerequisite && prerequisiteChainHasCycle(prerequisite, visiting)
      );
    },
  );

  visiting.delete(teaching.id);
  return hasCycle;
}

// A prerequisite only counts when learned for the same job, so it has to be offered to every job this teaching is.
function prerequisiteProblems(teaching: TrainerTeachingContent): string[] {
  const problems: string[] = [];

  teaching.requiredTrainerTeachingIds.forEach((prerequisiteId) => {
    const prerequisite = getEntry<TrainerTeachingContent>(prerequisiteId);
    if (!prerequisite) {
      problems.push(`requires unknown teaching "${prerequisiteId}"`);
      return;
    }

    const missingJobs = teaching.jobIds.filter(
      (jobId) => !prerequisite.jobIds.includes(jobId),
    );
    if (missingJobs.length > 0) {
      const names = missingJobs.map(
        (jobId) => getEntry<JobContent>(jobId)?.name ?? jobId,
      );
      problems.push(
        `requires "${prerequisite.name}", which ${names.join(', ')} can never learn`,
      );
    }

    if (prerequisite.requiredLevel > teaching.requiredLevel) {
      problems.push(
        `requires "${prerequisite.name}", which has a higher level requirement (${prerequisite.requiredLevel})`,
      );
    }
  });

  if (prerequisiteChainHasCycle(teaching))
    problems.push('has a circular prerequisite chain');

  return problems;
}

function toCheck(
  id: string,
  label: string,
  problems: string[],
  passMessage: string,
): AnalysisCheck {
  return problems.length > 0
    ? { id, label, status: 'fail', message: `${label} ${problems.join('; ')}.` }
    : { id, label, status: 'pass', message: passMessage };
}

export function runTrainersAnalysis(): AnalysisRunResult {
  const trainers = getEntriesByType<TrainerContent>('trainer');
  const teachings = getEntriesByType<TrainerTeachingContent>('trainerteaching');

  const trainerChecks = trainers.map((trainer) =>
    toCheck(
      `trainers:${trainer.id}`,
      trainer.name,
      trainerProblems(trainer),
      `${trainer.name} is placed once and teaches ${trainer.trainerTeachingIds.length} teaching(s).`,
    ),
  );

  const teachingChecks = teachings.map((teaching) =>
    toCheck(
      `trainerteachings:${teaching.id}`,
      teaching.name,
      [
        ...allocationProblems(teaching, trainers),
        ...referenceProblems(teaching),
        ...effectProblems(teaching),
        ...prerequisiteProblems(teaching),
      ],
      `${teaching.name} is allocated, satisfiable, and has valid effects.`,
    ),
  );

  const checks = [
    ...unnamedTrainerNodeChecks(),
    ...trainerChecks,
    ...teachingChecks,
  ];
  const failures = checks.filter((check) => check.status === 'fail').length;

  return {
    checks,
    summary:
      failures === 0
        ? `Every trainer (${trainers.length}) and teaching (${teachings.length}) is valid.`
        : `${failures} trainer/teaching problem(s) across ${trainers.length} trainer(s) and ${teachings.length} teaching(s).`,
  };
}
