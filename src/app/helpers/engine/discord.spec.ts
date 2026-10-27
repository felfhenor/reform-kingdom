import { beforeEach, describe, expect, it } from 'vitest';

import {
  ensureCaravan,
  ensureCaravanTrader,
} from '@helpers/content/ensure-caravan';
import { ensureGlobalEffect } from '@helpers/content/ensure-globaleffect';
import { ensureJob } from '@helpers/content/ensure-job';
import { ensureTown } from '@helpers/content/ensure-town';
import {
  discordSetMainStatus,
  discordUpdateStatus,
} from '@helpers/engine/discord';
import { activeTownNode, setGamePlayView } from '@helpers/engine/ui';
import { defaultOptions, setOption, setOptions } from '@helpers/state-options';
import type {
  CaravanId,
  CaravanTraderId,
  GameState,
  GlobalEffectContent,
  GlobalEffectId,
  JobId,
  TownId,
} from '@interfaces';
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
const elfheim = ensureTown({ id: 'elfheim' as TownId, name: 'Elfheim' });
const deathsDoor = ensureGlobalEffect({
  id: 'Deaths Door' as GlobalEffectId,
  name: 'Deaths Door',
});
const healing = ensureGlobalEffect({
  id: 'Healing' as GlobalEffectId,
  name: 'Healing',
});
const warrior = ensureJob({ id: 'warrior' as JobId, name: 'Warrior' });
const magician = ensureJob({ id: 'magician' as JobId, name: 'Magician' });

function runningInElectron(isElectron: boolean): void {
  Object.defineProperty(navigator, 'userAgent', {
    value: isElectron ? 'Mozilla/5.0 electron/30.0.0' : 'Mozilla/5.0',
    configurable: true,
  });
}

function withEffect(effect: GlobalEffectContent) {
  return (state: GameState) =>
    state.globalEffects.push({ ...effect, startTick: 0, expiresAtTick: 999 });
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
    { name: 'Elfheim', type: 'NonPlayerKingdom' },
  ]);
  activeTownNode.set(standingAt ? nodes[standingAt] : undefined);
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
  setOptions(defaultOptions());
  setGamePlayView('world');
  seedContent([
    caravan,
    trader,
    elfheim,
    deathsDoor,
    healing,
    warrior,
    magician,
  ]);
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

  it('shows visiting a town while on its screen, and resting there otherwise', () => {
    setGamePlayView('town');
    expect(presenceFor(undefined, 'Elfheim').state).toBe('Visiting Elfheim');
    expect(presenceFor(undefined, 'Carrina - Old Mill').state).toBe(
      'Resting at Carrina - Old Mill',
    );

    setGamePlayView('world');
    expect(presenceFor(undefined, 'Elfheim').state).toBe('Resting at Elfheim');
  });

  it('shows recovering at a node during Deaths Door or Healing', () => {
    expect(
      presenceFor(withEffect(deathsDoor), 'Carrina - Old Mill').state,
    ).toBe('Recovering at Carrina - Old Mill');
    expect(presenceFor(withEffect(healing), 'Carrina - Old Mill').state).toBe(
      'Recovering at Carrina - Old Mill',
    );
  });

  it('shows the title crawl over everything else, even while paused', () => {
    setOption('gameloopPaused', true);

    expect(
      presenceFor((state) => {
        state.meta.titleCrawlPending = true;
        state.world.combat = buildCombat();
      }).state,
    ).toBe('Starting a grand adventure');
  });

  it('prefixes the activity with paused while the game is paused', () => {
    setOption('gameloopPaused', true);

    expect(
      presenceFor(
        (state) =>
          (state.world.combat = buildCombat({
            locationName: 'Whispering Woods',
          })),
      ).state,
    ).toBe('Paused · Exploring Whispering Woods');
  });

  it('lists the party’s jobs and levels, then their average level, as the details line', () => {
    expect(
      presenceFor(
        (state) =>
          (state.world.party = [
            buildCharacter({ jobId: warrior.id, level: 5 }),
            buildCharacter({ jobId: magician.id, level: 3 }),
            buildCharacter({ jobId: 'gone' as JobId, level: 1 }),
            buildCharacter({ jobId: warrior.id, level: 2 }),
          ]),
      ).details,
    ).toBe(
      'Warrior Lv5, Magician Lv3, Adventurer Lv1, Warrior Lv2 · Avg. Lv. 3',
    );
  });
});
