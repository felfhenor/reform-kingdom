import type { CaravanContent, CaravanTraderContent } from '@interfaces';
import { shotWorldPrepare } from './shot-common';
import type { TrailerShot } from './types';

const CARAVAN_NODE = 'Goblin Group Company - Carrina';
// A goblin trader, for the "Humans! Buy stuff!" pitch under their name.
const TRADER = 'Graagnus';
const ACTIVE_TRADE_COUNT = 4;
const MAP_HOLD_MS = 1_500;
const TRADE_HOLD_MS = 4_000;

export const caravanShot: TrailerShot = {
  name: 'caravan',
  description: `${TRADER} the goblin opens shop at ${CARAVAN_NODE}.`,
  options: { game: { mapZoom: 2 }, hideToasts: true },

  async setup(t) {
    await shotWorldPrepare(t, CARAVAN_NODE);

    // Staffs the caravan with this trader now, the way a reroll would, minus the dice.
    await t.evaluate(
      async (api, { caravanName, traderName, tradeCount }) => {
        const caravan = api.getEntry<CaravanContent>(caravanName);
        const trader = api.getEntry<CaravanTraderContent>(traderName);
        if (!caravan || !trader) throw new Error('Caravan or trader missing.');
        if (api.caravanBusyTraderIds(caravan.id).has(trader.id)) {
          throw new Error(`${traderName} is already staffing another camp.`);
        }

        const activeTradeIndices = trader.trades
          .map((trade, index) => ({ trade, index }))
          .filter(({ trade }) => !api.caravanTradeUnlockOwned(trade))
          .slice(0, tradeCount)
          .map(({ index }) => index);

        const nowTick = api.timerTicksElapsed();
        await api.updateGamestate((state) => {
          state.world.caravans[caravan.id] = {
            traderId: trader.id,
            activeTradeIndices,
            rolledEquipment: {},
            tradeCounts: {},
            generatedAtTick: nowTick,
          };
          return state;
        });
      },
      {
        caravanName: CARAVAN_NODE,
        traderName: TRADER,
        tradeCount: ACTIVE_TRADE_COUNT,
      },
    );
  },

  async action(t) {
    await t.wait(MAP_HOLD_MS);

    await t.evaluate((api, nodeName) => {
      const node = api.worldNodeByName(nodeName);
      if (node) api.caravanTradeOpen(node);
    }, CARAVAN_NODE);
    t.log('trade open');
    await t.wait(TRADE_HOLD_MS);
  },
};
