import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { ledgerMark } from '@helpers/engine/ledger';
import { isRegionIntroSeen } from '@helpers/lore/region-intro';
import { updateGamestate } from '@helpers/state-game';

export async function regionIntroMarkSeen(mapName: string): Promise<void> {
  if (isRegionIntroSeen(mapName)) return;

  await updateGamestate((state) => {
    ledgerMark(state.regionIntros, mapName);
    return state;
  });

  analyticsSendDesignEvent(`Lore:RegionIntro:${analyticsSafeSegment(mapName)}`);
}
