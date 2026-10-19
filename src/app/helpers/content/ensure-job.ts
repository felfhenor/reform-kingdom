import {
  VALID_EQUIPMENT_ITEM_TYPES,
  VALID_SKILL_TREE_ROWS,
} from '@helpers/content/ensure-helpers-constants';
import {
  ensureArray,
  ensureEnumArray,
} from '@helpers/content/ensure-helpers-core';
import { ensureStats } from '@helpers/content/ensure-helpers-stats';
import type {
  EquipmentSkillId,
  JobAbilityId,
  JobAbilityLevel,
  JobContent,
  JobId,
  JobSkillPath,
  JobSkillPathLevel,
} from '@interfaces';

function ensureJobSkillPathLevel(
  level: Partial<JobSkillPathLevel> = {},
): JobSkillPathLevel {
  return {
    level: level.level ?? 1,
    skillId: level.skillId ?? ('UNKNOWN' as EquipmentSkillId),
  };
}

function ensureJobSkillPath(path: Partial<JobSkillPath> = {}): JobSkillPath {
  return {
    pathName: path.pathName ?? 'UNKNOWN',
    levels: ensureArray(path.levels, ensureJobSkillPathLevel),
  };
}

function ensureJobAbilityLevel(
  level: Partial<JobAbilityLevel> = {},
): JobAbilityLevel {
  return {
    jobAbilityId: level.jobAbilityId ?? ('UNKNOWN' as JobAbilityId),
    level: level.level ?? 1,
    value: level.value ?? 0,
  };
}

export function ensureJob(job: Partial<JobContent>): Required<JobContent> {
  return {
    id: job.id ?? ('UNKNOWN' as JobId),
    name: job.name ?? 'UNKNOWN',
    __type: 'job',
    shorthand: job.shorthand ?? 'JOB',
    description: job.description ?? 'UNKNOWN',
    baseStats: ensureStats(job.baseStats),
    statsPerLevel: ensureStats(job.statsPerLevel),
    sprite: job.sprite ?? 'UNKNOWN',
    frames: job.frames ?? 4,
    equippableTypes: ensureEnumArray(
      job.equippableTypes,
      VALID_EQUIPMENT_ITEM_TYPES,
    ),
    statPriority: ensureArray(job.statPriority, (prio) => ({
      stat: prio.stat ?? 'UNKNOWN',
      multiplier: prio.multiplier ?? 1,
    })),
    skillPath: ensureArray(job.skillPath, ensureJobSkillPath),
    abilities: ensureArray(job.abilities, ensureJobAbilityLevel),
    treeVersion: job.treeVersion ?? 1,
    treeRows: ensureEnumArray(job.treeRows, VALID_SKILL_TREE_ROWS),
    specializationRows: ensureEnumArray(
      job.specializationRows,
      VALID_SKILL_TREE_ROWS,
    ),
    defaultCombatOrders: job.defaultCombatOrders ?? [],
    starterEquipmentIds: job.starterEquipmentIds ?? [],
  };
}
