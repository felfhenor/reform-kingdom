import { getEntry } from '@helpers/content';
import {
  defaultAffinities,
  defaultCombatStats,
  defaultStats,
} from '@helpers/defaults';
import { heroSkillsAtLevel } from '@helpers/job';
import { rngUuid } from '@helpers/rng';
import type {
  Character,
  Combat,
  Combatant,
  CombatId,
  EquipmentSkillId,
  JobContent,
  MonsterContent,
  StatBlock,
} from '@interfaces';

function monsterStatsAtLevel(
  monster: MonsterContent,
  level: number,
): StatBlock {
  const stats = { ...monster.baseStats };

  (Object.keys(stats) as Array<keyof StatBlock>).forEach((stat) => {
    stats[stat] += monster.statsPerLevel[stat] * (level - 1);
  });

  return stats;
}

export function combatantFromCharacter(character: Character): Combatant {
  const job = getEntry<JobContent>(character.jobId);

  return {
    id: character.id,
    name: character.name,
    isEnemy: false,

    targettingType: 'Random',

    baseStats: structuredClone(character.stats),
    statBoosts: defaultStats(),
    totalStats: structuredClone(character.stats),
    hp: character.hp,
    ep: character.ep,
    level: character.level,
    sprite: job?.sprite ?? '',
    frames: job?.frames ?? 4,

    skillIds: job
      ? heroSkillsAtLevel(job, character.level)
      : ['Attack' as EquipmentSkillId],
    skillRefs: [],

    combatStats: defaultCombatStats(),

    affinity: defaultAffinities(),
    resistance: defaultAffinities(),

    skillUses: {},
    statusEffects: [],
    statusEffectData: {},
  };
}

export function combatantFromMonster(
  monster: MonsterContent,
  level: number,
  index: number,
): Combatant {
  const stats = monsterStatsAtLevel(monster, level);

  return {
    id: rngUuid(),
    monsterId: monster.id,
    name: `${monster.name} Lv.${level} [${String.fromCharCode(index + 65)}]`,
    isEnemy: true,

    targettingType: monster.targettingType,

    baseStats: structuredClone(stats),
    statBoosts: defaultStats(),
    totalStats: structuredClone(stats),
    hp: stats.Health,
    ep: stats.Energy,
    level,
    sprite: monster.sprite,
    frames: monster.frames,

    skillIds: monster.skills.map((skill) => skill.skillId),
    skillRefs: [],

    combatStats: defaultCombatStats(),

    affinity: defaultAffinities(),
    resistance: defaultAffinities(),

    skillUses: {},
    statusEffects: [],
    statusEffectData: {},
  };
}

export function combatCreateForEncounter(
  party: Character[],
  monsters: MonsterContent[],
  encounterLevel: number,
  locationName = 'Unknown',
): Combat {
  const heroes: Combatant[] = party.map((character) =>
    combatantFromCharacter(character),
  );

  const guardians: Combatant[] = monsters.map((monster, i) =>
    combatantFromMonster(monster, encounterLevel, i),
  );

  return {
    id: rngUuid() as CombatId,
    locationName,
    locationPosition: { x: 0, y: 0 },
    rounds: 0,
    heroes,
    guardians,
  };
}
