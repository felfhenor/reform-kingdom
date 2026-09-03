import { ensureArray } from '@helpers/content/ensure-helpers-core';
import { ensureDroppedReward } from '@helpers/content/ensure-helpers-drops';
import {
  ensureCombatStats,
  ensureStats,
} from '@helpers/content/ensure-helpers-stats';
import type {
  EquipmentSkillId,
  MonsterContent,
  MonsterId,
  MonsterSkill,
  TargettingPriorityEntry,
} from '@interfaces';

function ensureMonsterSkill(skill: Partial<MonsterSkill> = {}): MonsterSkill {
  return {
    skillId: skill.skillId ?? ('UNKNOWN' as EquipmentSkillId),
    weight: skill.weight ?? 1,
  };
}

function ensureTargettingPriorityEntry(
  entry: Partial<TargettingPriorityEntry> = {},
): TargettingPriorityEntry {
  return {
    type: entry.type ?? 'Random',
    jobId: entry.jobId,
  };
}

export function ensureMonster(
  monster: Partial<MonsterContent>,
): Required<MonsterContent> {
  return {
    id: monster.id ?? ('UNKNOWN' as MonsterId),
    name: monster.name ?? 'UNKNOWN',
    __type: 'monster',
    description: monster.description ?? 'UNKNOWN',
    sprite: monster.sprite ?? 'UNKNOWN',
    frames: monster.frames ?? 4,
    baseStats: ensureStats(monster.baseStats),
    statsPerLevel: ensureStats(monster.statsPerLevel),
    combatStats: ensureCombatStats(monster.combatStats),
    // A trailing unqualified Random is always appended, so a priority list can never resolve
    // zero targets and waste the monster's turn - content never needs to author its own catch-all.
    targetting: [
      ...ensureArray(monster.targetting, ensureTargettingPriorityEntry),
      { type: 'Random' },
    ],
    rarity: monster.rarity ?? 'Common',
    xp: monster.xp ?? { min: 0, max: 0 },
    drops: ensureArray(monster.drops, ensureDroppedReward),
    skills: ensureArray(monster.skills, ensureMonsterSkill),
  };
}
