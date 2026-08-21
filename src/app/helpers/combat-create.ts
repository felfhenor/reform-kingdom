import { combatApplyStatDeltaToCombatant } from '@helpers/combat-statuseffects';
import { getEntry } from '@helpers/content';
import {
  defaultAffinities,
  defaultCombatStats,
  defaultStats,
} from '@helpers/defaults';
import { equippedItemTypes } from '@helpers/equipment';
import { activeGlobalEffects } from '@helpers/global-effects';
import { heroSkillsWithEquipment } from '@helpers/job';
import { monsterStatsAtLevel } from '@helpers/monster';
import { rngUuid } from '@helpers/rng';
import { skillIsUsableWithEquippedWeapons } from '@helpers/skill';
import type {
  Character,
  Combat,
  Combatant,
  CombatId,
  EquipmentSkillContent,
  EquipmentSkillId,
  JobContent,
  MonsterContent,
} from '@interfaces';

function heroUsableSkillIds(
  character: Character,
  skillIds: EquipmentSkillId[],
): EquipmentSkillId[] {
  const equippedWeaponTypes = equippedItemTypes(character.equipment);

  return skillIds.filter((skillId) => {
    const skill = getEntry<EquipmentSkillContent>(skillId);
    return (
      !skill || skillIsUsableWithEquippedWeapons(skill, equippedWeaponTypes)
    );
  });
}

// Applied once here rather than read live, so the buff holds for the whole encounter even if its timer expires mid-fight.
// Health/Energy also tops up current hp/ep (not just max), so it's felt immediately even if not at full health.
function applyActiveGainStatsEffects(combatant: Combatant): void {
  activeGlobalEffects().forEach((effect) => {
    (effect.effects ?? []).forEach((effectEntry) => {
      if (effectEntry.effectType !== 'GainStats') return;
      combatApplyStatDeltaToCombatant(
        combatant,
        effectEntry.stat,
        effectEntry.value,
      );

      if (effectEntry.stat === 'Health') combatant.hp += effectEntry.value;
      if (effectEntry.stat === 'Energy') combatant.ep += effectEntry.value;
    });
  });
}

export function combatantFromCharacter(character: Character): Combatant {
  const job = getEntry<JobContent>(character.jobId);

  const combatant: Combatant = {
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
      ? heroUsableSkillIds(
          character,
          heroSkillsWithEquipment(
            job,
            character.level,
            character.equipment,
          ).map((skill) => skill.id),
        )
      : ['Attack' as EquipmentSkillId],
    skillRefs: [],
    skillWeights: {},

    combatOrders: character.combatOrders[character.jobId] ?? [],

    combatStats: defaultCombatStats(),

    affinity: defaultAffinities(),
    resistance: defaultAffinities(),

    skillUses: {},
    statusEffects: [],
    statusEffectData: {},
  };

  applyActiveGainStatsEffects(combatant);

  return combatant;
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
    skillWeights: Object.fromEntries(
      monster.skills.map((skill) => [skill.skillId, skill.weight]),
    ),

    combatOrders: [],

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
