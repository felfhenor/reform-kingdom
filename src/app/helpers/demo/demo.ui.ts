import { environment } from '@environments/environment';
import { demoRegionsAllSealed } from '@helpers/demo/demo';
import { analyticsSendDesignEvent } from '@helpers/engine/analytics';
import { metaState, updateGamestate } from '@helpers/state-game';

// The full game's store page; Wishlist buttons stay hidden while it's empty.
export const STEAM_STORE_URL = '';

export function isDemoBuild(): boolean {
  return environment.demo;
}

export function isDemoEndPending(): boolean {
  return isDemoBuild() && !metaState().demoEndSeen && demoRegionsAllSealed();
}

export async function demoEndDismiss(): Promise<void> {
  await updateGamestate((state) => {
    state.meta.demoEndSeen = true;
    return state;
  });

  analyticsSendDesignEvent('Demo:EndCard:Dismissed');
}
