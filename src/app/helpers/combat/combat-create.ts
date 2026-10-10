import { elementalResistanceClamp } from '@helpers/combat/combat-element';
import { combatStatsForCharacter } from '@helpers/combat/combat-stats';
import {
  combatApplyCombatStatNumberDeltaToCombatant,
  combatApplyStatDeltaToCombatant,
} from '@helpers/combat/combat-statuseffects';
import {
  monsterSkillsAtLevel,
  monsterStatsAtLevel,
} from '@helpers/combat/monster';
import { getEntry } from '@helpers/content/content';
import {
  defaultAffinities,
  defaultStats,
  defaultTagResistances,
} from '@helpers/defaults';
import { characterCombatSkills } from '@helpers/hero/job';
import { skillIsUsableWithEquippedWeapons } from '@helpers/hero/skill';
import {
  characterTagResistances,
  equipmentMonsterTypeDamageTotals,
  equippedItemTypes,
} from '@helpers/item/equipment';
import {
  characterElementalBoons,
  characterElementalResistances,
  equipmentGearElements,
} from '@helpers/item/equipment-element';
import { equipmentSkillStatBonuses } from '@helpers/item/equipment-skill-bonus';
import { rngUuid } from '@helpers/rng';
import { globalEffectSumsState } from '@helpers/state-game';
import type {
  Character,
  Combat,
  Combatant,
  CombatId,
  CombatStat,
  EquipmentSkillContent,
  EquipmentSkillId,
  GameStat,
  JobContent,
  MonsterContent,
  StatusEffectTag,
  TownDefenseGuardianEntry,
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
  const { stats } = globalEffectSumsState();

  (Object.keys(stats) as GameStat[]).forEach((stat) => {
    const value = stats[stat];
    if (value === 0) return;

    combatApplyStatDeltaToCombatant(combatant, stat, value);

    if (stat === 'Health') combatant.hp += value;
    if (stat === 'Energy') combatant.ep += value;
  });
}

// The Astral Projector's DebuffResistance spells add a flat percent to
// every tag, on top of whatever gear already grants.
function applyActiveDebuffResistanceEffects(combatant: Combatant): void {
  const { debuffResistanceFlat } = globalEffectSumsState();
  if (debuffResistanceFlat === 0) return;

  (Object.keys(combatant.tagResistance) as StatusEffectTag[]).forEach((tag) => {
    combatant.tagResistance[tag] += debuffResistanceFlat;
  });
}

function applyActiveDebuffResistanceTagEffects(combatant: Combatant): void {
  const { debuffResistanceTags } = globalEffectSumsState();

  (Object.keys(debuffResistanceTags) as StatusEffectTag[]).forEach((tag) => {
    const value = debuffResistanceTags[tag];
    if (value === 0) return;
    combatant.tagResistance[tag] += value;
  });
}

function applyActiveGainCombatStatEffects(combatant: Combatant): void {
  const { combatStats } = globalEffectSumsState();

  (Object.keys(combatStats) as CombatStat[]).forEach((combatStat) => {
    const value = combatStats[combatStat];
    if (value === 0) return;
    combatApplyCombatStatNumberDeltaToCombatant(combatant, combatStat, value);
  });
}

export function combatantFromCharacter(character: Character): Combatant {
  const job = getEntry<JobContent>(character.jobId);

  const combatant: Combatant = {
    id: character.id,
    name: character.name,
    isEnemy: false,

    targetting: [{ type: 'Random' }],
    jobId: character.jobId,

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
          characterCombatSkills(character).map((skill) => skill.id),
        )
      : ['Attack' as EquipmentSkillId],
    skillRefs: [],
    skillWeights: {},

    combatOrders: character.combatOrders[character.jobId] ?? [],

    combatStats: combatStatsForCharacter(character),
    monsterTypeDamageBonus: equipmentMonsterTypeDamageTotals(
      character.equipment,
    ),
    skillStatBonuses: equipmentSkillStatBonuses(character.equipment),

    affinity: characterElementalBoons(character),
    resistance: characterElementalResistances(character),
    gearElements: equipmentGearElements(character.equipment),
    tagResistance: characterTagResistances(character),

    skillUses: {},
    statusEffects: [],
    statusEffectData: {},
  };

  applyActiveGainStatsEffects(combatant);
  applyActiveDebuffResistanceEffects(combatant);
  applyActiveDebuffResistanceTagEffects(combatant);
  applyActiveGainCombatStatEffects(combatant);

  return combatant;
}

// A..Z, then AA, AB, ... so long fights never run out of labels.
export function combatantIndexLabel(index: number): string {
  const letter = String.fromCharCode((index % 26) + 65);
  return index < 26
    ? letter
    : `${combatantIndexLabel(Math.floor(index / 26) - 1)}${letter}`;
}

export function combatantFromMonster(
  monster: MonsterContent,
  level: number,
  index: number,
): Combatant {
  const stats = monsterStatsAtLevel(monster, level);
  const skills = monsterSkillsAtLevel(monster, level);

  return {
    id: rngUuid(),
    monsterId: monster.id,
    name: `${monster.name} Lv. ${level} [${combatantIndexLabel(index)}]`,
    isEnemy: true,

    targetting: monster.targetting,

    baseStats: structuredClone(stats),
    statBoosts: defaultStats(),
    totalStats: structuredClone(stats),
    hp: stats.Health,
    ep: stats.Energy,
    level,
    sprite: monster.sprite,
    frames: monster.frames,

    skillIds: skills.map((skill) => skill.skillId),
    skillRefs: [],
    skillWeights: Object.fromEntries(
      skills.map((skill) => [skill.skillId, skill.weight]),
    ),

    combatOrders: [],

    combatStats: structuredClone(monster.combatStats),

    affinity: defaultAffinities(),
    resistance: elementalResistanceClamp({
      ...defaultAffinities(),
      ...monster.elementalResistances,
    }),
    tagResistance: defaultTagResistances(),

    skillUses: {},
    statusEffects: [],
    statusEffectData: {},
  };
}

export function combatantsFromTownGuardians(
  entries: TownDefenseGuardianEntry[],
  level: number,
): Combatant[] {
  const monsters = entries.flatMap((entry) => {
    const monster = getEntry<MonsterContent>(entry.monsterId);
    if (!monster) return [];

    return Array.from({ length: entry.quantity }, () => monster);
  });

  return monsters.map((monster, i) => ({
    ...combatantFromMonster(monster, level, i),
    isEnemy: false,
  }));
}

export function combatCreateForEncounter(
  party: Character[],
  monsters: MonsterContent[],
  encounterLevel: number,
  locationName = 'Unknown',
  helpers: Combatant[] = [],
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
    helpers,
    guardians,
    elements: defaultAffinities(),
  };
}
