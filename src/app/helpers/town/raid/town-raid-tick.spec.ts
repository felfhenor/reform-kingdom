import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content/content', () => ({
  getEntriesByType: vi.fn(),
}));

vi.mock('@helpers/engine/analytics', () => ({
  analyticsSafeSegment: vi.fn((name: string) => name),
  analyticsSendDesignEvent: vi.fn(),
}));

vi.mock('@helpers/engine/notify', () => ({
  notifyError: vi.fn(),
}));

vi.mock('@helpers/engine/risk-band', () => ({
  riskBandForLevelRange: vi.fn(() => 'Medium'),
}));

vi.mock('@helpers/engine/timer', () => ({
  timerTicksElapsed: vi.fn(),
}));

vi.mock('@helpers/item/gathering', () => ({
  partyMinLevel: vi.fn(() => 10),
}));

vi.mock('@helpers/pathfinding/pathfinding', () => ({
  mapHopsBetween: vi.fn(() => 0),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

vi.mock('@helpers/town/reputation/town-reputation', () => ({
  townReputationTier: vi.fn(() => 0),
}));

vi.mock('@helpers/town/raid/town-raid-defense', () => ({
  raidDefenseGlobalEffectApply: vi.fn(),
}));

vi.mock('@helpers/town/raid/town-raid-resolve', () => ({
  raidResolveDefeat: vi.fn(),
}));

vi.mock('@helpers/town/raid/town-raid-state', () => ({
  raidAssaulterMonsterIds: vi.fn(() => []),
}));

vi.mock('@helpers/town/town-tick', () => ({
  isTownDueForUpdate: vi.fn(() => true),
  markTownSubsystemProcessed: vi.fn(),
}));

vi.mock('@helpers/world-node/world-nodes', () => ({
  worldNodeByName: vi.fn(),
  worldNodesOfType: vi.fn(() => []),
}));

import { getEntriesByType } from '@helpers/content/content';
import { notifyError } from '@helpers/engine/notify';
import { riskBandForLevelRange } from '@helpers/engine/risk-band';
import { timerTicksElapsed } from '@helpers/engine/timer';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { raidResolveDefeat } from '@helpers/town/raid/town-raid-resolve';
import { raidAssaulterMonsterIds } from '@helpers/town/raid/town-raid-state';
import {
  RAID_COOLDOWN_TICKS,
  townRaidProcessTick,
} from '@helpers/town/raid/town-raid-tick';
import {
  isTownDueForUpdate,
  markTownSubsystemProcessed,
} from '@helpers/town/town-tick';
import type {
  GameState,
  MonsterId,
  TownContent,
  TownId,
  TownNodeState,
} from '@interfaces';

const townId = 'larsia' as TownId;

function buildTown(): TownContent {
  return {
    id: townId,
    name: 'Larsia',
    level: 25,
    defense: {
      rewards: [],
      guardian: { reputationTiers: [] },
      assaulter: {
        numMonsters: 1,
        monsterIds: [],
        level: { min: 20, max: 25 },
      },
      quests: { commissions: [] },
    },
  } as TownContent;
}

function buildTownState(overrides: Partial<TownNodeState> = {}): TownNodeState {
  return {
    lastProcessedTick: {},
    stock: [],
    workers: {},
    reputation: 0,
    hiddenGold: 0,
    materials: {},
    tradeskills: {},
    craftQueue: [],
    firstVisitedAtTick: 0,
    ...overrides,
  };
}

function mockGamestate(
  townState: TownNodeState | undefined,
  combatRaidTownId?: string,
) {
  vi.mocked(gamestate).mockReturnValue({
    world: {
      combat: combatRaidTownId
        ? ({ raidTownId: combatRaidTownId } as never)
        : undefined,
      towns: townState ? { [townId]: townState } : {},
    },
  } as unknown as GameState);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getEntriesByType).mockReturnValue([buildTown()] as never);
  vi.mocked(isTownDueForUpdate).mockReturnValue(true);
  vi.mocked(timerTicksElapsed).mockReturnValue(1000);
  // mockReturnValue persists across tests (vi.clearAllMocks doesn't reset it) - pin the default explicitly.
  vi.mocked(riskBandForLevelRange).mockReturnValue('Medium');
  vi.mocked(raidAssaulterMonsterIds).mockReturnValue([]);
});

describe('townRaidProcessTick', () => {
  it('skips a town not due for update', () => {
    vi.mocked(isTownDueForUpdate).mockReturnValue(false);
    mockGamestate(buildTownState());

    townRaidProcessTick();

    expect(markTownSubsystemProcessed).not.toHaveBeenCalled();
    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('does nothing for a town that has never been visited', () => {
    mockGamestate(buildTownState({ firstVisitedAtTick: undefined }));

    townRaidProcessTick();

    expect(updateGamestate).not.toHaveBeenCalled();
    expect(raidResolveDefeat).not.toHaveBeenCalled();
  });

  it('skips a town whose raid combat is currently being fought', () => {
    mockGamestate(buildTownState({ raidTelegraphedAtTick: 900 }), townId);

    townRaidProcessTick();

    expect(updateGamestate).not.toHaveBeenCalled();
    expect(raidResolveDefeat).not.toHaveBeenCalled();
  });

  it('auto-resolves as a defeat once the engage window has passed', () => {
    mockGamestate(
      buildTownState({
        raidTelegraphedAtTick: 500,
        raidEngageWindowExpiresAtTick: 999,
      }),
    );

    townRaidProcessTick();

    expect(notifyError).toHaveBeenCalled();
    expect(raidResolveDefeat).toHaveBeenCalledWith(townId);
    expect(markTownSubsystemProcessed).toHaveBeenCalledWith(townId, 'raid');
  });

  it('does nothing while telegraphed but still within the engage window', () => {
    mockGamestate(
      buildTownState({
        raidTelegraphedAtTick: 500,
        raidEngageWindowExpiresAtTick: 1500,
      }),
    );

    townRaidProcessTick();

    expect(raidResolveDefeat).not.toHaveBeenCalled();
    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('does not telegraph while still within the once/day cooldown', () => {
    mockGamestate(
      buildTownState({
        lastRaidResolvedAtTick: 1000 - RAID_COOLDOWN_TICKS + 1,
      }),
    );

    townRaidProcessTick();

    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('does not telegraph when the assaulter is too high-risk for the party', () => {
    vi.mocked(riskBandForLevelRange).mockReturnValue('TooHigh');
    mockGamestate(buildTownState());

    townRaidProcessTick();

    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('telegraphs a raid once eligible, rolling and storing the assaulter list once', () => {
    const rolledIds = ['Bloodmoth' as MonsterId, 'Bloodmoth' as MonsterId];
    vi.mocked(raidAssaulterMonsterIds).mockReturnValue(rolledIds);
    mockGamestate(buildTownState());

    townRaidProcessTick();

    expect(raidAssaulterMonsterIds).toHaveBeenCalledTimes(1);
    expect(updateGamestate).toHaveBeenCalled();
    const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
    const state = {
      world: { towns: { [townId]: buildTownState() } },
    } as unknown as GameState;
    const result = updateFn(state);

    expect(result.world.towns[townId].raidTelegraphedAtTick).toBe(1000);
    expect(
      result.world.towns[townId].raidEngageWindowExpiresAtTick,
    ).toBeGreaterThan(1000);
    expect(result.world.towns[townId].raidTelegraphedAssaulterIds).toBe(
      rolledIds,
    );
    expect(markTownSubsystemProcessed).toHaveBeenCalledWith(townId, 'raid');
  });
});
