import type { CollectibleContent } from '@interfaces';
import { shotWorldPrepare } from './shot-common';
import type { TrailerShot } from './types';

const COLLECTIBLE = 'Gobweb';
const REVEALED_NODE = 'Spider Tower';
const START_NODE = 'Slimed Waystation';

export const collectibleRevealShot: TrailerShot = {
  name: 'collectible-reveal',
  description: `${COLLECTIBLE} is found and ${REVEALED_NODE} appears on the map.`,
  options: { game: { mapZoom: 2 }, hideToasts: true },

  async setup(t) {
    await shotWorldPrepare(t, START_NODE);

    await t.evaluate(async (api, collectibleName) => {
      const id = api.getEntry<CollectibleContent>(collectibleName)?.id;
      if (!id) throw new Error(`No collectible named "${collectibleName}".`);

      await api.updateGamestate((state) => {
        delete state.collectibles[id];
        return state;
      });
    }, COLLECTIBLE);

    await t.evaluate(
      (api, nodeName) => api.worldNodeUndiscover(nodeName),
      REVEALED_NODE,
    );
    await t.until((api, nodeName) => {
      const node = api.worldNodeByName(nodeName);
      return !!node && !api.isWorldNodeCollectibleGateMet(node);
    }, REVEALED_NODE);

    await t.evaluate((api, nodeName) => {
      const node = api.worldNodeByName(nodeName);
      if (node) api.worldCameraFocus(node);
    }, REVEALED_NODE);

    // Lets the 150ms node-visibility poll hide the node before recording starts.
    await t.wait(300);
  },

  async action(t) {
    await t.wait(2_000);

    t.log(`${COLLECTIBLE} found`);
    await t.evaluate((api, collectibleName) => {
      const id = api.getEntry<CollectibleContent>(collectibleName)?.id;
      if (id) api.debugGiveCollectible(id, 1);
    }, COLLECTIBLE);

    await t.until(
      (api, nodeName) => api.isWorldNodeDiscovered(nodeName),
      REVEALED_NODE,
    );
    t.log(`${REVEALED_NODE} revealed`);

    await t.wait(3_000);
  },
};
