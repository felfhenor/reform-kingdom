import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/town/raid/town-raid-resolve');

import {
  HIGH_RISK_LEVELS_ABOVE_PARTY,
  RAID_BASE_WARNING_TICKS,
  RAID_CHECK_INTERVAL_TICKS,
  RAID_COOLDOWN_TICKS,
  RAID_WARNING_TICKS_PER_MAP_HOP,
  RAID_WARNING_TICKS_PER_REPUTATION_TIER,
} from '@helpers/config';
import { ensureGlobalEffect } from '@helpers/content/ensure-globaleffect';
import { ensureTown, ensureTownDefense } from '@helpers/content/ensure-town';
import { globalEffectsState, worldTownsState } from '@helpers/state-game';
import { raidResolveDefeat } from '@helpers/town/raid/town-raid-resolve';
import { townRaidProcessTick } from '@helpers/town/raid/town-raid-tick';
import { TOWN_REPUTATION_THRESHOLDS } from '@helpers/town/reputation/town-reputation';
import type {
  GameState,
  GlobalEffectId,
  MonsterId,
  TownContent,
  TownId,
  TownNodeState,
} from '@interfaces';
import { captureAnalyticsEvents } from '@/testing/analytics';
import {
  buildCharacter,
  buildCombat,
  buildTownNodeState,
} from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';
import { captureNotifications } from '@/testing/notify';
import { seedWorldNodes } from '@/testing/world';

const now = 10_000;
const bloodmoth = 'bloodmoth' as MonsterId;
const assaulterLevel = { min: 20, max: 25 };
const raidEffect = ensureGlobalEffect({
  id: 'raid-defense' as GlobalEffectId,
  name: 'Raid Defense Requested',
});
const larsia: TownContent = ensureTown({
  id: 'larsia' as TownId,
  name: 'Larsia',
  defense: ensureTownDefense({
    assaulter: {
      numMonsters: 2,
      monsterIds: [bloodmoth],
      level: assaulterLevel,
    },
  }),
});

function seedTown(
  town: Partial<TownNodeState> = {},
  edit: (state: GameState) => void = () => undefined,
  partyLevel = assaulterLevel.max,
): void {
  seedGamestate((state) => {
    state.clock.numTicks = now;
    state.world.party = [buildCharacter({ level: partyLevel })];
    state.world.towns[larsia.id] = buildTownNodeState({
      firstVisitedAtTick: 0,
      ...town,
    });
    edit(state);
  });
}

function townState(): TownNodeState {
  return worldTownsState()[larsia.id];
}

const tick = () => inTick(townRaidProcessTick);

beforeEach(() => {
  vi.clearAllMocks();
  seedContent([larsia, raidEffect]);
});

describe('townRaidProcessTick', () => {
  it('telegraphs a raid with its rolled assaulters and a warning window, requesting defense', () => {
    seedTown();
    const events = captureAnalyticsEvents();

    tick();

    expect(townState()).toMatchObject({
      raidTelegraphedAtTick: now,
      raidEngageWindowExpiresAtTick: now + RAID_BASE_WARNING_TICKS,
      raidTelegraphedAssaulterIds: [bloodmoth, bloodmoth],
      lastProcessedTick: { raid: now },
    });
    expect(globalEffectsState()).toEqual([
      expect.objectContaining({
        id: raidEffect.id,
        extendedDescription: 'Larsia',
      }),
    ]);
    expect(events).toContain('Town:Raid:Telegraph:Larsia');
  });

  it('gives a more trusted town a longer warning', () => {
    seedTown({ reputation: TOWN_REPUTATION_THRESHOLDS[1] });

    tick();

    expect(townState().raidEngageWindowExpiresAtTick).toBe(
      now + RAID_BASE_WARNING_TICKS + RAID_WARNING_TICKS_PER_REPUTATION_TIER,
    );
  });

  it('gives a town further from the Duchy a longer warning', () => {
    seedWorldNodes([
      { name: 'Duchy', type: 'Kingdom', mapName: 'Carrina', x: 1 },
      {
        name: 'To the Desert',
        type: 'TeleportNode',
        mapName: 'Carrina',
        x: 2,
        properties: [{ name: 'toTag', type: 'string', value: 'desert' }],
      },
      {
        name: 'From Carrina',
        type: 'TeleportNode',
        mapName: 'LarsianDesert',
        x: 1,
        properties: [{ name: 'tag', type: 'string', value: 'desert' }],
      },
      {
        name: larsia.name,
        type: 'NonPlayerKingdom',
        mapName: 'LarsianDesert',
        x: 5,
      },
    ]);
    seedTown();

    tick();

    expect(townState().raidEngageWindowExpiresAtTick).toBe(
      now + RAID_BASE_WARNING_TICKS + RAID_WARNING_TICKS_PER_MAP_HOP,
    );
  });

  it('loses an undefended raid once its warning runs out, and not before', () => {
    const notifications = captureNotifications();
    seedTown({
      raidTelegraphedAtTick: 1,
      raidEngageWindowExpiresAtTick: now + 1,
    });
    tick();
    expect(raidResolveDefeat).not.toHaveBeenCalled();
    expect(townState()).toMatchObject({
      raidTelegraphedAtTick: 1,
      raidEngageWindowExpiresAtTick: now + 1,
    });

    seedTown({ raidTelegraphedAtTick: 1, raidEngageWindowExpiresAtTick: now });
    tick();
    expect(raidResolveDefeat).toHaveBeenCalledWith(larsia.id);
    expect(notifications).toEqual([
      expect.objectContaining({ message: expect.stringContaining('Larsia') }),
    ]);
  });

  it.each([
    [
      'during cooldown',
      () => seedTown({ lastRaidResolvedAtTick: now - RAID_COOLDOWN_TICKS + 1 }),
    ],
    [
      'mid-fight',
      () =>
        seedTown({}, (state) => {
          state.world.combat = buildCombat({ raidTownId: larsia.id });
        }),
    ],
    [
      'when too dangerous for the party',
      () =>
        seedTown(
          {},
          () => undefined,
          assaulterLevel.min - HIGH_RISK_LEVELS_ABOVE_PARTY - 1,
        ),
    ],
    [
      'before the town is visited',
      () => seedTown({ firstVisitedAtTick: undefined }),
    ],
  ])('never raids a town %s', (_, seed) => {
    seed();

    tick();

    expect(townState().raidTelegraphedAtTick).toBeUndefined();
  });

  it('raids again once the cooldown has passed', () => {
    seedTown({ lastRaidResolvedAtTick: now - RAID_COOLDOWN_TICKS });

    tick();

    expect(townState().raidTelegraphedAtTick).toBe(now);
  });

  it('only checks once per interval', () => {
    seedTown({
      lastProcessedTick: { raid: now - RAID_CHECK_INTERVAL_TICKS + 1 },
    });

    tick();

    expect(townState().raidTelegraphedAtTick).toBeUndefined();
  });
});
