import { getEntry } from '@helpers/content/content';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { updateGamestate } from '@helpers/state-game';
import { canSetHomeNode } from '@helpers/town/town-spawn';
import type { TownContent, TownId } from '@interfaces';

export function homeNodeSet(townId: TownId): void {
  if (!canSetHomeNode(townId)) return;

  const town = getEntry<TownContent>(townId);
  if (!town) return;

  updateGamestate((state) => {
    state.world.homeNodeName = town.name;
    return state;
  });

  analyticsSendDesignEvent(`Town:Home:Set:${analyticsSafeSegment(town.name)}`);
}
