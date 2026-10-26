import type { Combat, WorkerContent } from '@interfaces';
import { shotFightToEnd, shotWorldPrepare } from './shot-common';
import type { TrailerShot } from './types';

const WORKER = 'Weaver Welch';
// Welch is this encounter's guaranteed completion reward.
const ENCOUNTER_NODE = 'Spider Tower';
// Outlasts the encounter's own loot popups so they don't overlap the quote.
const LOOT_CLEAR_MS = 3_000;
const QUOTE_HOLD_MS = 5_000;

export const rescueShot: TrailerShot = {
  name: 'rescue',
  description: `The party clears ${ENCOUNTER_NODE} and rescues ${WORKER}.`,
  options: { game: { mapZoom: 2 }, hideToasts: true },

  async setup(t) {
    await shotWorldPrepare(t, ENCOUNTER_NODE);
  },

  async action(t) {
    // Welch stays rescued through the fight so its own completion loot can't grant him early.
    await shotFightToEnd(t, ENCOUNTER_NODE);
    await t.wait(LOOT_CLEAR_MS);

    await t.evaluate((api, workerName) => {
      const workerId = api.getEntry<WorkerContent>(workerName)?.id;
      if (!workerId) throw new Error(`No worker named "${workerName}".`);

      api.debugRecallWorker(workerId);
      api.workerUndiscover(workerId);
    }, WORKER);
    // Both writes are deferred outside a tick, and the grant is a no-op while Welch still counts as rescued.
    await t.until((api, workerName) => {
      const workerId = api.getEntry<WorkerContent>(workerName)?.id;
      return !!workerId && !api.isWorkerRescued(workerId);
    }, WORKER);

    await t.evaluate(
      (api, { workerName, nodeName }) => {
        const workerId = api.getEntry<WorkerContent>(workerName)?.id;
        if (!workerId) return;

        const combat = {
          locationName: nodeName,
          heroes: [],
          helpers: [],
          guardians: [],
        } as unknown as Combat;
        api.grantResolvedDrops(combat, [{ kind: 'Worker', workerId }]);
      },
      { workerName: WORKER, nodeName: ENCOUNTER_NODE },
    );
    t.log('rescued');
    await t.wait(QUOTE_HOLD_MS);
  },
};
