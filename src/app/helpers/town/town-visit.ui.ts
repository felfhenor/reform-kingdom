import { getEntriesByType } from '@helpers/content/content';
import { isTownVisited } from '@helpers/town/town-visit';
import type { TownContent } from '@interfaces';

export function visitedTowns(): TownContent[] {
  return getEntriesByType<TownContent>('town').filter((town) =>
    isTownVisited(town.id),
  );
}
