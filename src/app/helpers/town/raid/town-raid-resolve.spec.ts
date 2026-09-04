import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/combat/combat-rewards', () => ({
  grantResolvedDrops: vi.fn(),
}));

vi.mock('@helpers/content/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/engine/analytics', () => ({
  analyticsSafeSegment: vi.fn((name: string) => name),
  analyticsSendDesignEvent: vi.fn(),
}));

vi.mock('@helpers/engine/timer', () => ({
  timerTicksElapsed: vi.fn(() => 1000),
}));

vi.mock('@helpers/item/loot', () => ({
  rollDroppedRewards: vi.fn(() => []),
}));

vi.mock('@helpers/state-game', () => ({
  updateGamestate: vi.fn(),
}));

vi.mock('@helpers/town/reputation/town-reputation', () => ({
  townReputationGain: vi.fn(),
  townReputationLose: vi.fn(),
}));

import { grantResolvedDrops } from '@helpers/combat/combat-rewards';
import { getEntry } from '@helpers/content/content';
import { rollDroppedRewards } from '@helpers/item/loot';
import { updateGamestate } from '@helpers/state-game';
import {
  raidResolveDefeat,
  raidResolveVictory,
} from '@helpers/town/raid/town-raid-resolve';
import {
  townReputationGain,
  townReputationLose,
} from '@helpers/town/reputation/town-reputation';
import type { Combat, GameState, TownContent, TownId } from '@interfaces';

const townId = 'larsia' as TownId;

function buildTown(overrides: Partial<TownContent> = {}): TownContent {
  return {
    id: townId,
    name: 'Larsia',
    level: 25,
    defense: {
      rewards: [{ itemId: 'gold-coin' as never, chance: 100 }],
      guardian: { reputationTiers: [] },
      assaulter: { numMonsters: 0, monsterIds: [], level: { min: 1, max: 1 } },
      quests: { commissions: [] },
    },
    ...overrides,
  } as TownContent;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getEntry).mockReturnValue(buildTown() as never);
});

describe('raidResolveVictory', () => {
  it('grants the town raid reward table and gains reputation', () => {
    const combat = { locationName: 'Larsia' } as Combat;
    const drops = [{ itemId: 'gold-coin' as never, quantity: 500 }];
    vi.mocked(rollDroppedRewards).mockReturnValue(drops as never);

    raidResolveVictory(combat, townId);

    expect(rollDroppedRewards).toHaveBeenCalledWith(
      buildTown().defense.rewards,
      25,
    );
    expect(grantResolvedDrops).toHaveBeenCalledWith(combat, drops);
    expect(townReputationGain).toHaveBeenCalledWith(townId, 100, 'RaidDefense');
  });

  it('sets lastRaidResolvedAtTick', () => {
    raidResolveVictory({} as Combat, townId);

    const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
    const state = {
      world: { towns: { [townId]: { lastRaidResolvedAtTick: undefined } } },
    } as unknown as GameState;
    const result = updateFn(state);

    expect(result.world.towns[townId].lastRaidResolvedAtTick).toBe(1000);
  });

  it('does nothing when the town no longer resolves', () => {
    vi.mocked(getEntry).mockReturnValue(undefined);

    raidResolveVictory({} as Combat, townId);

    expect(grantResolvedDrops).not.toHaveBeenCalled();
    expect(townReputationGain).not.toHaveBeenCalled();
    expect(updateGamestate).not.toHaveBeenCalled();
  });
});

describe('raidResolveDefeat', () => {
  it('loses reputation and applies the craft-speed debuff', () => {
    raidResolveDefeat(townId);

    expect(townReputationLose).toHaveBeenCalledWith(townId, 50, 'RaidDefense');

    const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
    const state = {
      world: {
        towns: {
          [townId]: {
            lastRaidResolvedAtTick: undefined,
            craftSpeedDebuffExpiresAtTick: undefined,
            raidTelegraphedAtTick: 900,
            raidEngageWindowExpiresAtTick: 1200,
            raidTelegraphedAssaulterIds: ['Bloodmoth' as never],
          },
        },
      },
    } as unknown as GameState;
    const result = updateFn(state);

    expect(result.world.towns[townId].lastRaidResolvedAtTick).toBe(1000);
    expect(result.world.towns[townId].craftSpeedDebuffExpiresAtTick).toBe(4600);
    expect(result.world.towns[townId].raidTelegraphedAtTick).toBeUndefined();
    expect(
      result.world.towns[townId].raidEngageWindowExpiresAtTick,
    ).toBeUndefined();
    expect(
      result.world.towns[townId].raidTelegraphedAssaulterIds,
    ).toBeUndefined();
  });

  it('does nothing when the town no longer resolves', () => {
    vi.mocked(getEntry).mockReturnValue(undefined);

    raidResolveDefeat(townId);

    expect(townReputationLose).not.toHaveBeenCalled();
    expect(updateGamestate).not.toHaveBeenCalled();
  });
});
