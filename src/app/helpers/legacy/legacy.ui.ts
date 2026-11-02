import { analyticsSendDesignEvent } from '@helpers/engine/analytics';
import { error } from '@helpers/engine/logging';
import { notifyError } from '@helpers/engine/notify';
import {
  legacy,
  legacyRecordRun,
  legacyRunById,
  legacyRunFromGame,
} from '@helpers/legacy/legacy';
import { isFelDefeated } from '@helpers/lore/outro';
import { waitForGameloopIdle } from '@helpers/savefile/savefile-load';
import type { EdictId, GameId, RunOutcome, SavefileBackup } from '@interfaces';
import { uniq } from 'es-toolkit/compat';

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

export function legacyHasCompletedRun(): boolean {
  return legacy().runs.some((run) => run.outcome === 'Completed');
}

export function legacyClearedEdictIds(): EdictId[] {
  return uniq(
    legacy()
      .runs.filter((run) => run.outcome === 'Completed')
      .flatMap((run) => run.edicts),
  );
}
