import { getEntriesByType, getEntry } from '@helpers/content/content';
import {
  mergeGrantedSkills,
  skillIsSpecial,
  skillNameTier,
} from '@helpers/hero/skill';
import { characterNonGearEffects } from '@helpers/hero/hero-effect';
import {
  skillModifiersForFamily,
  skillWithModifiers,
} from '@helpers/hero/skill-modifier';
import { affixEffectsOfKind } from '@helpers/item/affix';
import { equipmentGrantedSkillIds } from '@helpers/item/equipment';
import type {
  Character,
  CharacterStatSource,
  EquipmentBlock,
  EquipmentSkill,
  EquipmentSkillContent,
  EquipmentSkillId,
  HeroEffect,
  JobContent,
  JobId,
} from '@interfaces';
import { sortBy, uniq } from 'es-toolkit/compat';

export function getUnlockedJobs(): JobContent[] {
  return getEntriesByType<JobContent>('job');
}

// Level the hero would resume a job at: their current level if it's the active job, else their saved progress, else 1 for a job never held.
export function characterJobLevel(
  character: Pick<Character, 'jobId' | 'level' | 'jobProgress'>,
  jobId: JobId,
): number {
  if (character.jobId === jobId) return character.level;
  return character.jobProgress?.[jobId]?.level ?? 1;
}

// Every hero always knows Attack; it's never part of a skill tree.
const HERO_BASE_SKILL_IDS = ['Attack' as EquipmentSkillId];

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

// Attack plus every equipment- or effect-granted skill, keeping only the highest tier of each family.
export function heroSkillsWithEquipment(
  equipment: EquipmentBlock,
  effects: HeroEffect[],
): EquipmentSkill[] {
  const baseSkills = resolveSkills(HERO_BASE_SKILL_IDS);
  const grantedSkills = resolveSkills([
    ...equipmentGrantedSkillIds(equipment),
    ...effectGrantedSkillIds(effects),
  ]);

  return mergeGrantedSkills(baseSkills, grantedSkills).map((skill) =>
    skillWithModifiers(skill, skillModifiersForFamily(effects, skill.family)),
  );
}

// A hero's full skill list from their current job's tree, gear and every job's teachings.
export function characterSkills(
  character: CharacterStatSource,
): EquipmentSkill[] {
  if (!getEntry<JobContent>(character.jobId)) return [];

  return heroSkillsWithEquipment(
    character.equipment,
    characterNonGearEffects(character),
  );
}

export function characterNormalSkills(
  character: CharacterStatSource,
): EquipmentSkill[] {
  return characterSkills(character).filter((skill) => !skillIsSpecial(skill));
}

// Every granted tier, unmerged, so each learned tier stays pickable.
function characterUnmergedSkillIds(
  character: CharacterStatSource,
): EquipmentSkillId[] {
  return uniq([
    ...HERO_BASE_SKILL_IDS,
    ...equipmentGrantedSkillIds(character.equipment),
    ...effectGrantedSkillIds(characterNonGearEffects(character)),
  ]);
}

export function characterBurstSkillOptions(
  character: CharacterStatSource,
): EquipmentSkill[] {
  if (!getEntry<JobContent>(character.jobId)) return [];

  const effects = characterNonGearEffects(character);
  const specials = resolveSkills(characterUnmergedSkillIds(character))
    .filter(skillIsSpecial)
    .map((skill) =>
      skillWithModifiers(skill, skillModifiersForFamily(effects, skill.family)),
    );
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
): EquipmentSkill[] {
  const chosen = character.burstSkills?.[character.jobId] ?? [];
  return characterBurstSkillOptions(character).filter((skill) =>
    chosen.includes(skill.id),
  );
}

export function characterCombatSkills(
  character: CharacterStatSource & Pick<Character, 'burstSkills'>,
): EquipmentSkill[] {
  return [
    ...characterNormalSkills(character),
    ...characterChosenBurstSkills(character),
  ];
}
