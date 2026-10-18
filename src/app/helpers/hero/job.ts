import { getEntriesByType, getEntry } from '@helpers/content/content';
import {
  mergeGrantedSkills,
  skillIsSpecial,
  skillNameTier,
} from '@helpers/hero/skill';
import { characterNonGearEffects } from '@helpers/hero/hero-effect';
import { affixEffectsOfKind } from '@helpers/item/affix';
import { equipmentGrantedSkillIds } from '@helpers/item/equipment';
import type {
  Character,
  CharacterStatSource,
  EquipmentBlock,
  EquipmentSkillContent,
  EquipmentSkillId,
  HeroEffect,
  JobContent,
} from '@interfaces';
import { sortBy, uniq } from 'es-toolkit/compat';

export function getUnlockedJobs(): JobContent[] {
  return getEntriesByType<JobContent>('job');
}

export function heroSkillsAtLevel(
  job: JobContent,
  level: number,
): EquipmentSkillId[] {
  return job.skillPath
    .map((path) => {
      const unlocked = path.levels.filter((entry) => entry.level <= level);
      return sortBy(unlocked, (entry) => -entry.level)[0]?.skillId;
    })
    .filter((skillId): skillId is EquipmentSkillId => !!skillId);
}

function resolveSkills(skillIds: EquipmentSkillId[]): EquipmentSkillContent[] {
  return skillIds
    .map((id) => getEntry<EquipmentSkillContent>(id))
    .filter((skill): skill is EquipmentSkillContent => !!skill);
}

function effectGrantedSkillIds(effects: HeroEffect[]): EquipmentSkillId[] {
  return affixEffectsOfKind(effects, 'GrantSkill').map(
    (effect) => effect.skillId,
  );
}

// A hero's full skill list: their job-path skills at the given level, with
// any equipment- or effect-granted skills merged in.
export function heroSkillsWithEquipment(
  job: JobContent,
  level: number,
  equipment: EquipmentBlock,
  effects: HeroEffect[],
): EquipmentSkillContent[] {
  const baseSkills = resolveSkills(heroSkillsAtLevel(job, level));
  const grantedSkills = resolveSkills([
    ...equipmentGrantedSkillIds(equipment),
    ...effectGrantedSkillIds(effects),
  ]);

  return mergeGrantedSkills(baseSkills, grantedSkills);
}

// A hero's full skill list from their own job, level, gear and every job's teachings.
export function characterSkills(
  character: CharacterStatSource,
): EquipmentSkillContent[] {
  const job = getEntry<JobContent>(character.jobId);
  if (!job) return [];

  return heroSkillsWithEquipment(
    job,
    character.level,
    character.equipment,
    characterNonGearEffects(character),
  );
}

export function characterNormalSkills(
  character: CharacterStatSource,
): EquipmentSkillContent[] {
  return characterSkills(character).filter((skill) => !skillIsSpecial(skill));
}

// Every unlocked job-path level plus gear and teaching grants, so each learned tier stays pickable.
function characterUnmergedSkillIds(
  character: CharacterStatSource,
  job: JobContent,
): EquipmentSkillId[] {
  return uniq([
    ...job.skillPath.flatMap((path) =>
      path.levels
        .filter((entry) => entry.level <= character.level)
        .map((entry) => entry.skillId),
    ),
    ...equipmentGrantedSkillIds(character.equipment),
    ...effectGrantedSkillIds(characterNonGearEffects(character)),
  ]);
}

export function characterBurstSkillOptions(
  character: CharacterStatSource,
): EquipmentSkillContent[] {
  const job = getEntry<JobContent>(character.jobId);
  if (!job) return [];

  const specials = resolveSkills(
    characterUnmergedSkillIds(character, job),
  ).filter(skillIsSpecial);
  return sortBy(specials, [
    (skill) => skill.family,
    (skill) => skillNameTier(skill.name).tier,
  ]);
}

export function partyFirstBurstSkillHero(
  party: Character[],
): Character | undefined {
  return party.find(
    (character) => characterBurstSkillOptions(character).length > 0,
  );
}

// Drops a chosen skill the hero no longer knows, e.g. after unequipping the gear that granted it.
export function characterChosenBurstSkills(
  character: CharacterStatSource & Pick<Character, 'burstSkills'>,
): EquipmentSkillContent[] {
  const chosen = character.burstSkills?.[character.jobId] ?? [];
  return characterBurstSkillOptions(character).filter((skill) =>
    chosen.includes(skill.id),
  );
}

export function characterCombatSkills(
  character: CharacterStatSource & Pick<Character, 'burstSkills'>,
): EquipmentSkillContent[] {
  return [
    ...characterNormalSkills(character),
    ...characterChosenBurstSkills(character),
  ];
}
