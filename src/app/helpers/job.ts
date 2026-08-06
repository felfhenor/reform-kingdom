import { getEntriesByType } from '@helpers/content';
import type { EquipmentSkillId, JobContent } from '@interfaces';
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
