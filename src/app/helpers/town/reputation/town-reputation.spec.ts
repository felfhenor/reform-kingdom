import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/task/task-events');

import { defaultGameState } from '@helpers/defaults';
import { gamestate } from '@helpers/state-game';
import { taskEventTownReputationTier } from '@helpers/task/task-events';
import {
  TOWN_REPUTATION_MAX,
  TOWN_REPUTATION_THRESHOLDS,
  townReputation,
  townReputationGain,
  townReputationLose,
  townReputationTier,
  townReputationTierForAmount,
  townReputationTierMultiplier,
  townReputationTierName,
} from '@helpers/town/reputation/town-reputation';
import type { TownId } from '@interfaces';
import { captureAnalyticsEvents } from '@/testing/analytics';
import { buildTownNodeState } from '@/testing/builders';
import { seedGamestate } from '@/testing/gamestate';

const townId = 'larsia' as TownId;
const TIER_1 = TOWN_REPUTATION_THRESHOLDS[1];
const TIER_2 = TOWN_REPUTATION_THRESHOLDS[2];

function seedReputation(reputation: number): void {
  seedGamestate((state) => {
    state.world.towns[townId] = buildTownNodeState({ reputation });
  });
}

function reputation(): number {
  return gamestate().world.towns[townId].reputation;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('townReputationTierForAmount', () => {
  it('reaches each tier exactly at its threshold', () => {
    Object.entries(TOWN_REPUTATION_THRESHOLDS).forEach(([tier, threshold]) => {
      expect(townReputationTierForAmount(threshold)).toBe(Number(tier));
      if (threshold > 0) {
        expect(townReputationTierForAmount(threshold - 1)).toBe(
          Number(tier) - 1,
        );
      }
    });
  });

  it('stays at the top tier past the max', () => {
    expect(townReputationTierForAmount(TOWN_REPUTATION_MAX * 10)).toBe(
      townReputationTierForAmount(TOWN_REPUTATION_MAX),
    );
  });
});

describe('townReputationTierName', () => {
  it('names tiers, falling back to Neutral out of range', () => {
    expect(townReputationTierName(0)).toBe('Neutral');
    expect(townReputationTierName(1)).toBe('Friendly');
    expect(townReputationTierName(99)).toBe('Neutral');
  });
});

describe('townReputation / townReputationTier', () => {
  it('reads the live reputation, or 0 for a town never visited', () => {
    seedReputation(TIER_2);

    expect(townReputation(townId)).toBe(TIER_2);
    expect(townReputationTier(townId)).toBe(2);
    expect(townReputation('other' as TownId)).toBe(0);
  });

  it('reads a passed state instead of the live one', () => {
    seedReputation(0);
    const state = defaultGameState();
    state.world.towns[townId] = buildTownNodeState({ reputation: TIER_2 });

    expect(townReputation(townId, state)).toBe(TIER_2);
    expect(townReputationTier(townId, state)).toBe(2);
  });
});

describe('townReputationGain', () => {
  it('adds reputation and fires an analytics event tagged with the source', async () => {
    seedReputation(0);
    const events = captureAnalyticsEvents();

    await townReputationGain(townId, 10, 'RaidDefense');

    expect(reputation()).toBe(10);
    expect(events).toEqual(['Town:Reputation:RaidDefense']);
  });

  it('reports a tier crossing, including to the task system', async () => {
    seedReputation(TIER_1 - 10);

    await expect(townReputationGain(townId, 5, 'Trade')).resolves.toBe(false);
    expect(taskEventTownReputationTier).not.toHaveBeenCalled();

    await expect(townReputationGain(townId, 5, 'Trade')).resolves.toBe(true);
    expect(taskEventTownReputationTier).toHaveBeenCalledWith(townId, 1);
  });

  it('clamps at the max rather than climbing past it', async () => {
    seedReputation(TOWN_REPUTATION_MAX - 50);

    await townReputationGain(townId, 500, 'Trade');

    expect(reputation()).toBe(TOWN_REPUTATION_MAX);
  });

  it('does nothing for a non-positive amount or a town never visited', async () => {
    const before = seedGamestate();
    const events = captureAnalyticsEvents();

    await townReputationGain(townId, 0, 'Trade');
    await townReputationGain(townId, -5, 'Trade');
    await expect(townReputationGain(townId, 10, 'Trade')).resolves.toBe(false);

    expect(gamestate()).toBe(before);
    expect(events).toEqual([]);
    expect(taskEventTownReputationTier).not.toHaveBeenCalled();
  });
});

describe('townReputationLose', () => {
  it('subtracts reputation and fires a distinct Lose analytics event', async () => {
    seedReputation(100);
    const events = captureAnalyticsEvents();

    await townReputationLose(townId, 30, 'RaidDefense');

    expect(reputation()).toBe(70);
    expect(events).toEqual(['Town:Reputation:Lose:RaidDefense']);
  });

  it('clamps at 0 rather than going negative', async () => {
    seedReputation(20);

    await townReputationLose(townId, 50, 'RaidDefense');

    expect(reputation()).toBe(0);
  });

  it('reports whether the loss crossed a tier threshold', async () => {
    seedReputation(TIER_1 + 10);

    await expect(townReputationLose(townId, 5, 'RaidDefense')).resolves.toBe(
      false,
    );
    await expect(townReputationLose(townId, 10, 'RaidDefense')).resolves.toBe(
      true,
    );
  });

  it('does nothing for a non-positive amount or a town never visited', async () => {
    const before = seedGamestate();
    const events = captureAnalyticsEvents();

    await townReputationLose(townId, 0, 'RaidDefense');
    await expect(townReputationLose(townId, 10, 'RaidDefense')).resolves.toBe(
      false,
    );

    expect(gamestate()).toBe(before);
    expect(events).toEqual([]);
  });
});

describe('townReputationTierMultiplier', () => {
  it('uses the highest defined tier at or below the current one', () => {
    expect(townReputationTierMultiplier(2, { 2: 0.9 })).toBe(0.9);
    expect(townReputationTierMultiplier(3, { 1: 0.95, 4: 0.5 })).toBe(0.95);
    expect(townReputationTierMultiplier(1, { 4: 0.5 })).toBeUndefined();
  });
});
