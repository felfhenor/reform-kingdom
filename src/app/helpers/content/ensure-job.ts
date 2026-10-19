import {
  VALID_EQUIPMENT_ITEM_TYPES,
  VALID_SKILL_TREE_ROWS,
} from '@helpers/content/ensure-helpers-constants';
import {
  ensureArray,
  ensureEnumArray,
} from '@helpers/content/ensure-helpers-core';
import { ensureStats } from '@helpers/content/ensure-helpers-stats';
import type { JobContent, JobId } from '@interfaces';

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
