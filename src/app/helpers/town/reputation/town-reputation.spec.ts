import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/engine/analytics', () => ({
  analyticsSendDesignEvent: vi.fn(),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

import { analyticsSendDesignEvent } from '@helpers/engine/analytics';
import { gamestate, updateGamestate } from '@helpers/state-game';
import {
  townReputation,
  townReputationDisplay,
  townReputationGain,
  townReputationLose,
  townReputationTier,
  townReputationTierForAmount,
  townReputationTierMultiplier,
  townReputationTierName,
} from '@helpers/town/reputation/town-reputation';
import type { GameState, TownId } from '@interfaces';

const townId = 'larsia' as TownId;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('townReputationTierForAmount', () => {
  it.each([
    [0, 0],
    [99, 0],
    [100, 1],
    [599, 1],
    [600, 2],
    [2099, 2],
    [2100, 3],
    [7099, 3],
    [7100, 4],
    [999999, 4],
  ])('maps %i reputation to tier %i', (reputation, tier) => {
    expect(townReputationTierForAmount(reputation)).toBe(tier);
  });
});

describe('townReputationTierName', () => {
  it('names each tier', () => {
    expect(townReputationTierName(0)).toBe('Neutral');
    expect(townReputationTierName(1)).toBe('Friendly');
    expect(townReputationTierName(4)).toBe('Renowned');
  });

  it('falls back to Neutral for an out-of-range tier', () => {
    expect(townReputationTierName(99)).toBe('Neutral');
  });
});

describe('townReputation', () => {
  it("reads the town's live reputation", () => {
    vi.mocked(gamestate).mockReturnValue({
      world: { towns: { [townId]: { reputation: 250 } } },
    } as unknown as GameState);

    expect(townReputation(townId)).toBe(250);
  });

  it('returns 0 when the town has no state entry', () => {
    vi.mocked(gamestate).mockReturnValue({
      world: { towns: {} },
    } as unknown as GameState);

    expect(townReputation(townId)).toBe(0);
  });
});

describe('townReputationTier', () => {
  it("resolves the town's current tier from its live reputation", () => {
    vi.mocked(gamestate).mockReturnValue({
      world: { towns: { [townId]: { reputation: 1500 } } },
    } as unknown as GameState);

    expect(townReputationTier(townId)).toBe(2);
  });
});

describe('townReputationDisplay', () => {
  it('includes the next tier and threshold when not yet at max', () => {
    vi.mocked(gamestate).mockReturnValue({
      world: { towns: { [townId]: { reputation: 250 } } },
    } as unknown as GameState);

    expect(townReputationDisplay(townId)).toEqual({
      reputation: 250,
      tierName: 'Friendly',
      nextThreshold: 600,
      nextTierName: 'Honored',
    });
  });

  it('omits the next tier and threshold at max reputation (Renowned)', () => {
    vi.mocked(gamestate).mockReturnValue({
      world: { towns: { [townId]: { reputation: 9000 } } },
    } as unknown as GameState);

    expect(townReputationDisplay(townId)).toEqual({
      reputation: 9000,
      tierName: 'Renowned',
      nextThreshold: undefined,
      nextTierName: undefined,
    });
  });
});

describe('townReputationGain', () => {
  it("adds the amount to the town's reputation", () => {
    const state = {
      world: { towns: { [townId]: { reputation: 100 } } },
    } as unknown as GameState;
    vi.mocked(updateGamestate).mockImplementation(async (fn) => fn(state));

    townReputationGain(townId, 50, 'Trade');

    expect(state.world.towns[townId].reputation).toBe(150);
  });

  it('fires an analytics event tagged with the source', () => {
    vi.mocked(updateGamestate).mockImplementation(async (fn) =>
      fn({
        world: { towns: { [townId]: { reputation: 0 } } },
      } as unknown as GameState),
    );

    townReputationGain(townId, 10, 'RaidDefense');

    expect(analyticsSendDesignEvent).toHaveBeenCalledWith(
      'Town:Reputation:RaidDefense',
    );
  });

  it('is a no-op for a zero or negative amount', () => {
    townReputationGain(townId, 0, 'Trade');
    townReputationGain(townId, -5, 'Trade');

    expect(updateGamestate).not.toHaveBeenCalled();
    expect(analyticsSendDesignEvent).not.toHaveBeenCalled();
  });

  it('does not throw when the town has no state entry', () => {
    const state = { world: { towns: {} } } as unknown as GameState;
    vi.mocked(updateGamestate).mockImplementation(async (fn) => fn(state));

    expect(() => townReputationGain(townId, 10, 'Trade')).not.toThrow();
  });
});

describe('townReputationLose', () => {
  it("subtracts the amount from the town's reputation", () => {
    const state = {
      world: { towns: { [townId]: { reputation: 100 } } },
    } as unknown as GameState;
    vi.mocked(updateGamestate).mockImplementation(async (fn) => fn(state));

    townReputationLose(townId, 30, 'RaidDefense');

    expect(state.world.towns[townId].reputation).toBe(70);
  });

  it('clamps at 0 rather than going negative', () => {
    const state = {
      world: { towns: { [townId]: { reputation: 20 } } },
    } as unknown as GameState;
    vi.mocked(updateGamestate).mockImplementation(async (fn) => fn(state));

    townReputationLose(townId, 50, 'RaidDefense');

    expect(state.world.towns[townId].reputation).toBe(0);
  });

  it('fires a distinct Lose analytics event tagged with the source', () => {
    vi.mocked(updateGamestate).mockImplementation(async (fn) =>
      fn({
        world: { towns: { [townId]: { reputation: 100 } } },
      } as unknown as GameState),
    );

    townReputationLose(townId, 10, 'RaidDefense');

    expect(analyticsSendDesignEvent).toHaveBeenCalledWith(
      'Town:Reputation:Lose:RaidDefense',
    );
  });

  it('is a no-op for a zero or negative amount', () => {
    townReputationLose(townId, 0, 'RaidDefense');
    townReputationLose(townId, -5, 'RaidDefense');

    expect(updateGamestate).not.toHaveBeenCalled();
    expect(analyticsSendDesignEvent).not.toHaveBeenCalled();
  });

  it('does not throw when the town has no state entry', () => {
    const state = { world: { towns: {} } } as unknown as GameState;
    vi.mocked(updateGamestate).mockImplementation(async (fn) => fn(state));

    expect(() => townReputationLose(townId, 10, 'RaidDefense')).not.toThrow();
  });
});

describe('townReputationTierMultiplier', () => {
  it('returns the exact tier entry when defined', () => {
    expect(townReputationTierMultiplier(2, { 2: 0.9 })).toBe(0.9);
  });

  it('falls back to the highest defined tier below the current one', () => {
    expect(townReputationTierMultiplier(3, { 1: 0.95, 4: 0.5 })).toBe(0.95);
  });

  it('returns undefined when no tier at or below the current one is defined', () => {
    expect(townReputationTierMultiplier(1, { 4: 0.5 })).toBeUndefined();
  });
});
