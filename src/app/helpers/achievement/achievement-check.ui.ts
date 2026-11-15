import {
  achievementsEarnedByRuns,
  achievementsSafely,
} from '@helpers/achievement/achievement-check';
import { achievementsUnlock } from '@helpers/achievement/achievement-unlock';
import { legacy } from '@helpers/legacy/legacy';

export function achievementsCheckLegacy(): void {
  achievementsSafely(
    () => achievementsUnlock(achievementsEarnedByRuns(legacy().runs), true),
    undefined,
  );
}
