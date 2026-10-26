import type { WorkerId } from '@interfaces';
import { shotWorldPrepare } from './shot-common';
import type { TrailerShot } from './types';

// The two gather nodes nearest the Duchy, so worker trips stay on screen.
const GATHER_NODES = ['Wergen Woods', 'Carrina Copper Mines'];
const PARTY_NODE = 'Wergen Woods';
// Frames Wergen Woods and the Duchy of Carrina, where most worker trips run.
const CAMERA_CENTER = { x: 24, y: 27 };
const MAP_NAME = 'Carrina';
const SETUP_TICK_MULTIPLIER = 20;
const SHOT_TICK_MULTIPLIER = 10;
const WORKERS_ARRIVE_MAX_MS = 90_000;
const BUSTLE_MS = 10_000;

export const kingdomBustleShot: TrailerShot = {
  name: 'kingdom-bustle',
  description: 'Workers and the party gathering around the Duchy at speed.',
  options: { game: { mapZoom: 2 }, hideToasts: true },

  async setup(t) {
    await shotWorldPrepare(t, PARTY_NODE);

    const workerIds = await t.evaluate((api, nodeNames) => {
      const ids = Object.keys(api.workersState()) as WorkerId[];
      return ids.filter((workerId, index) => {
        const nodeName = nodeNames[index % nodeNames.length];
        const node = api.worldNodeByName(nodeName);
        const itemId = node
          ? api.worldNodeGatherMaterialIds(node)[0]
          : undefined;
        return !!itemId && api.workerAssign(workerId, nodeName, itemId);
      });
    }, GATHER_NODES);
    if (workerIds.length === 0) throw new Error('No worker could be assigned.');
    t.log(`${workerIds.length} workers assigned`);

    // Workers out on other maps have to walk home first, so that's fast-forwarded off camera.
    await t.evaluate(
      (api, multiplier) => api.setOption('debugTickMultiplier', multiplier),
      SETUP_TICK_MULTIPLIER,
    );
    await t.until(
      (api, { ids, mapName }) =>
        ids.every((id) => api.workersState()[id]?.location.mapName === mapName),
      { ids: workerIds, mapName: MAP_NAME },
      WORKERS_ARRIVE_MAX_MS,
    );

    await t.evaluate(
      (api, { nodeName, multiplier, center }) => {
        api.setOption('debugTickMultiplier', multiplier);
        api.gatheringStart(nodeName);
        api.worldCameraFocus(center);
      },
      {
        nodeName: PARTY_NODE,
        multiplier: SHOT_TICK_MULTIPLIER,
        center: CAMERA_CENTER,
      },
    );
  },

  async action(t) {
    t.log('bustle');
    await t.wait(BUSTLE_MS);
  },
};
