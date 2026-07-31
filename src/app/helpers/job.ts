import { getEntriesByType } from '@helpers/content';
import type { JobContent } from '@interfaces';

export function getUnlockedJobs(): JobContent[] {
  return getEntriesByType<JobContent>('job');
}
