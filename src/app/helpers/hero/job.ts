import { getEntriesByType, getEntry } from '@helpers/content';
import { mergeGrantedSkills } from '@helpers/hero/skill';
import { equipmentGrantedSkillIds } from '@helpers/item/equipment';
import type {
  EquipmentBlock,
  EquipmentSkillContent,
  EquipmentSkillId,
  JobContent,
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
// any equipment-granted skills merged in (see `mergeGrantedSkills`).
export function heroSkillsWithEquipment(
  job: JobContent,
  level: number,
  equipment: EquipmentBlock,
): EquipmentSkillContent[] {
  const baseSkills = resolveSkills(heroSkillsAtLevel(job, level));
  const grantedSkills = resolveSkills(equipmentGrantedSkillIds(equipment));

  return mergeGrantedSkills(baseSkills, grantedSkills);
}
