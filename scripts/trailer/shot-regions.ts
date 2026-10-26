import { shotWorldPrepare } from './shot-common';
import type { TrailerShot } from './types';

const START_NODE = 'Slimed Waystation';
// One showpiece node per region, in the order the regions darken.
const REGION_NODES = [
  'Ghostyard',
  'Elfheim',
  'Larsia',
  'Collapsed Temple',
  'Diurtar',
];
const CARD_REVEAL_MS_PER_CHARACTER = 30;
const CARD_HOLD_AFTER_REVEAL_MS = 1_000;

export const regionsShot: TrailerShot = {
  name: 'regions',
  description: 'Each region intro card types out, from the Mire to the Felway.',
  options: { game: { mapZoom: 1.5 }, hideToasts: true },

  async setup(t) {
    await shotWorldPrepare(t, START_NODE);

    await t.evaluate(async (api, nodeNames) => {
      const mapNames = nodeNames.map(
        (name) => api.worldNodeByName(name)?.mapName,
      );
      await api.updateGamestate((state) => {
        mapNames.forEach((mapName) => {
          if (mapName) delete state.regionIntros[mapName];
        });
        return state;
      });
    }, REGION_NODES);
  },

  async action(t) {
    for (const nodeName of REGION_NODES) {
      await t.teleport(nodeName);
      t.log(nodeName);

      const length = await t.evaluate(
        (api, name) =>
          api.regionForMap(api.worldNodeByName(name)?.mapName ?? '')
            ?.description?.length ?? 0,
        nodeName,
      );
      await t.wait(
        length * CARD_REVEAL_MS_PER_CHARACTER + CARD_HOLD_AFTER_REVEAL_MS,
      );
    }
  },
};
