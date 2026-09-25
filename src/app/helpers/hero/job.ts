import { getEntriesByType, getEntry } from '@helpers/content/content';
import { mergeGrantedSkills } from '@helpers/hero/skill';
import { equipmentGrantedSkillIds } from '@helpers/item/equipment';
import {
  characterAllTeachingIds,
  trainerTeachingGrantedSkillIds,
} from '@helpers/trainer/trainer-teaching';
import type {
  CharacterStatSource,
  EquipmentBlock,
  EquipmentSkillContent,
  EquipmentSkillId,
  JobContent,
  TrainerTeachingId,
} from '@interfaces';
import { sortBy } from 'es-toolkit/compat';

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

// A hero's full skill list: their job-path skills at the given level, with
// any equipment- or teaching-granted skills merged in.
export function heroSkillsWithEquipment(
  job: JobContent,
  level: number,
  equipment: EquipmentBlock,
  teachingIds: TrainerTeachingId[],
): EquipmentSkillContent[] {
  const baseSkills = resolveSkills(heroSkillsAtLevel(job, level));
  const grantedSkills = resolveSkills([
    ...equipmentGrantedSkillIds(equipment),
    ...trainerTeachingGrantedSkillIds(teachingIds),
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
    characterAllTeachingIds(character),
  );
}
