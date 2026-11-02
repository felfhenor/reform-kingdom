import { analyticsSendDesignEvent } from '@helpers/engine/analytics';
import { error } from '@helpers/engine/logging';
import { notifyError } from '@helpers/engine/notify';
import {
  legacyRecordRun,
  legacyRunById,
  legacyRunFromGame,
} from '@helpers/legacy/legacy';
import { isFelDefeated } from '@helpers/lore/outro';
import { waitForGameloopIdle } from '@helpers/savefile/savefile-load';
import type { GameId, RunOutcome, SavefileBackup } from '@interfaces';

export function legacyRunOutcome(): RunOutcome {
  return isFelDefeated() ? 'Completed' : 'Abandoned';
}

// The caller pauses first; a tick batch still in flight would otherwise commit over the reset that follows.
export async function legacyEndRun(): Promise<GameId | undefined> {
  await waitForGameloopIdle();

  try {
    const run = legacyRunFromGame(legacyRunOutcome());
    legacyRecordRun(run);
    analyticsSendDesignEvent(`Legacy:EndRun:${run.outcome}`);
    return run.id;
  } catch (e) {
    error('Legacy', 'Failed to record the run:', e);
    notifyError('Could not save this run to your Legacy, so it was not ended.');
    return undefined;
  }
}

// Backups whose newest run is already in the Legacy were finished on purpose, not lost.
export function legacyHasUnfinishedBackup(backups: SavefileBackup[]): boolean {
  const newest = backups[0];
  return !!newest && !legacyRunById(newest.gameId as GameId);
}
