import {
  VALID_EQUIPMENT_ITEM_TYPES,
  VALID_GAME_STATS,
} from '@helpers/content/ensure-helpers-constants';
import {
  ensureArray,
  ensureEnumArray,
} from '@helpers/content/ensure-helpers-core';
import { ensureStats } from '@helpers/content/ensure-helpers-stats';
import type {
  EquipmentSkillId,
  JobContent,
  JobId,
  JobSkillPath,
  JobSkillPathLevel,
} from '../../interfaces';

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

export function ensureJob(job: Partial<JobContent>): Required<JobContent> {
  return {
    id: job.id ?? ('UNKNOWN' as JobId),
    name: job.name ?? 'UNKNOWN',
    __type: 'job',
    description: job.description ?? 'UNKNOWN',
    baseStats: ensureStats(job.baseStats),
    statsPerLevel: ensureStats(job.statsPerLevel),
    sprite: job.sprite ?? 'UNKNOWN',
    frames: job.frames ?? 4,
    equippableTypes: ensureEnumArray(
      job.equippableTypes,
      VALID_EQUIPMENT_ITEM_TYPES,
    ),
    statPriority: ensureEnumArray(job.statPriority, VALID_GAME_STATS),
    skillPath: ensureArray(job.skillPath, ensureJobSkillPath),
  };
}
