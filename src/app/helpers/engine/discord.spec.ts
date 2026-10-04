import { beforeEach, describe, expect, it } from 'vitest';

import {
  ensureCaravan,
  ensureCaravanTrader,
} from '@helpers/content/ensure-caravan';
import { ensureJob } from '@helpers/content/ensure-job';
import {
  discordSetMainStatus,
  discordUpdateStatus,
  isInElectron,
} from '@helpers/engine/discord';
import type { CaravanId, CaravanTraderId, GameState, JobId } from '@interfaces';
import {
  buildCaravanNodeState,
  buildCharacter,
  buildCombat,
} from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';
import { locationOf, seedWorldNodes } from '@/testing/world';

type DiscordWindow = Window & {
  discordRPCStatus?: { state?: string; details?: string };
};

const caravanNodeName = 'Goblin Group Company - Carrina';
const caravan = ensureCaravan({
  id: 'caravan-1' as CaravanId,
  name: caravanNodeName,
});
const trader = ensureCaravanTrader({
  id: 'trader-1' as CaravanTraderId,
  name: 'Grix the Merchant',
});
const warrior = ensureJob({ id: 'warrior' as JobId, name: 'Warrior' });
const magician = ensureJob({ id: 'magician' as JobId, name: 'Magician' });

function runningInElectron(isElectron: boolean): void {
  Object.defineProperty(navigator, 'userAgent', {
    value: isElectron ? 'Mozilla/5.0 electron/30.0.0' : 'Mozilla/5.0',
    configurable: true,
  });
}

const status = () => (window as DiscordWindow).discordRPCStatus ?? {};

// Updates the presence for a game seeded by `edit`, standing at `standingAt` (or off any node).
function presenceFor(
  edit: (state: GameState) => void = () => {},
  standingAt?: string,
) {
  const nodes = seedWorldNodes([
    { name: caravanNodeName, type: 'CaravanNode' },
    { name: 'Carrina - Old Mill', type: 'Kingdom' },
  ]);
  seedGamestate((state) => {
    state.world.currentLocation = standingAt
      ? locationOf(nodes[standingAt])
      : { mapName: 'TestMap', x: 50, y: 50 };
    edit(state);
  });
  discordUpdateStatus();
  return status();
}

beforeEach(() => {
  delete (window as DiscordWindow).discordRPCStatus;
  discordSetMainStatus('');
  runningInElectron(true);
  seedContent([caravan, trader, warrior, magician]);
});

describe('isInElectron', () => {
  it('detects electron from the user agent', () => {
    expect(isInElectron()).toBe(true);

    runningInElectron(false);
    expect(isInElectron()).toBe(false);
  });
});

describe('discordUpdateStatus', () => {
  it('does nothing outside electron', () => {
    runningInElectron(false);

    presenceFor((state) => (state.world.combat = buildCombat()));

    expect((window as DiscordWindow).discordRPCStatus).toBeUndefined();
  });

  it('shows combat first, then travel, then gathering', () => {
    const traveling = (state: GameState) =>
      (state.world.travel = {
        status: 'Traveling',
        destinationNodeName: 'Carrina',
        path: [],
        ticksIntoStep: 0,
      });
    const gathering = (state: GameState) =>
      (state.world.gathering = {
        status: 'Gathering',
        nodeName: 'Iron Vein',
        ticksIntoGather: 0,
      });

    expect(
      presenceFor((state) => {
        traveling(state);
        state.world.combat = buildCombat({ locationName: 'Whispering Woods' });
      }).state,
    ).toBe('Exploring Whispering Woods');
    expect(
      presenceFor((state) => {
        traveling(state);
        gathering(state);
      }).state,
    ).toBe('Traveling to Carrina');
    expect(presenceFor(gathering).state).toBe('Gathering in Iron Vein');
  });

  it('shows trading with a caravan’s current trader, or resting at its brand name without one', () => {
    expect(
      presenceFor(
        (state) =>
          (state.world.caravans[caravan.id] = buildCaravanNodeState({
            traderId: trader.id,
          })),
        caravanNodeName,
      ).state,
    ).toBe('Trading with Grix the Merchant');
    expect(presenceFor(undefined, caravanNodeName).state).toBe(
      'Resting at Goblin Group Company',
    );
  });

  it('ignores a leftover destination or gather node once idle', () => {
    expect(
      presenceFor((state) => {
        state.world.travel.destinationNodeName = 'Carrina';
        state.world.gathering.nodeName = 'Iron Vein';
      }).state,
    ).toBe('Traveling');
  });

  it('shows resting at any other node, and traveling off every node', () => {
    expect(presenceFor(undefined, 'Carrina - Old Mill').state).toBe(
      'Resting at Carrina - Old Mill',
    );
    expect(presenceFor().state).toBe('Traveling');
  });

  it('lists the party’s jobs and levels as the details line', () => {
    expect(
      presenceFor(
        (state) =>
          (state.world.party = [
            buildCharacter({ jobId: warrior.id, level: 5 }),
            buildCharacter({ jobId: magician.id, level: 3 }),
            buildCharacter({ jobId: 'gone' as JobId, level: 1 }),
          ]),
      ).details,
    ).toBe('Warrior Lv5, Magician Lv3, Adventurer Lv1');
  });
});
