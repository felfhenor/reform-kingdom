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

describe('townReputationGain', () => {
  it("adds the amount to the town's reputation", async () => {
    const state = {
      world: { towns: { [townId]: { reputation: 100 } } },
    } as unknown as GameState;
    vi.mocked(updateGamestate).mockImplementation(async (fn) => {
      fn(state);
    });

    await townReputationGain(townId, 50, 'Trade');

    expect(state.world.towns[townId].reputation).toBe(150);
  });

  it('fires an analytics event tagged with the source', async () => {
    vi.mocked(updateGamestate).mockImplementation(async (fn) => {
      fn({
        world: { towns: { [townId]: { reputation: 0 } } },
      } as unknown as GameState);
    });

    await townReputationGain(townId, 10, 'RaidDefense');

    expect(analyticsSendDesignEvent).toHaveBeenCalledWith(
      'Town:Reputation:RaidDefense',
    );
  });

  it('is a no-op for a zero or negative amount', async () => {
    await townReputationGain(townId, 0, 'Trade');
    await townReputationGain(townId, -5, 'Trade');

    expect(updateGamestate).not.toHaveBeenCalled();
    expect(analyticsSendDesignEvent).not.toHaveBeenCalled();
  });

  it('does not throw when the town has no state entry', async () => {
    const state = { world: { towns: {} } } as unknown as GameState;
    vi.mocked(updateGamestate).mockImplementation(async (fn) => {
      fn(state);
    });

    await expect(
      townReputationGain(townId, 10, 'Trade'),
    ).resolves.not.toThrow();
  });

  it('returns true when the gain crosses a tier threshold', async () => {
    const state = {
      world: { towns: { [townId]: { reputation: 90 } } },
    } as unknown as GameState;
    vi.mocked(updateGamestate).mockImplementation(async (fn) => {
      fn(state);
    });

    await expect(townReputationGain(townId, 20, 'Trade')).resolves.toBe(true);
  });

  it('returns false when the gain stays within the same tier', async () => {
    const state = {
      world: { towns: { [townId]: { reputation: 0 } } },
    } as unknown as GameState;
    vi.mocked(updateGamestate).mockImplementation(async (fn) => {
      fn(state);
    });

    await expect(townReputationGain(townId, 20, 'Trade')).resolves.toBe(
      false,
    );
  });
});

describe('townReputationLose', () => {
  it("subtracts the amount from the town's reputation", async () => {
    const state = {
      world: { towns: { [townId]: { reputation: 100 } } },
    } as unknown as GameState;
    vi.mocked(updateGamestate).mockImplementation(async (fn) => {
      fn(state);
    });

    await townReputationLose(townId, 30, 'RaidDefense');

    expect(state.world.towns[townId].reputation).toBe(70);
  });

  it('clamps at 0 rather than going negative', async () => {
    const state = {
      world: { towns: { [townId]: { reputation: 20 } } },
    } as unknown as GameState;
    vi.mocked(updateGamestate).mockImplementation(async (fn) => {
      fn(state);
    });

    await townReputationLose(townId, 50, 'RaidDefense');

    expect(state.world.towns[townId].reputation).toBe(0);
  });

  it('fires a distinct Lose analytics event tagged with the source', async () => {
    vi.mocked(updateGamestate).mockImplementation(async (fn) => {
      fn({
        world: { towns: { [townId]: { reputation: 100 } } },
      } as unknown as GameState);
    });

    await townReputationLose(townId, 10, 'RaidDefense');

    expect(analyticsSendDesignEvent).toHaveBeenCalledWith(
      'Town:Reputation:Lose:RaidDefense',
    );
  });

  it('is a no-op for a zero or negative amount', async () => {
    await townReputationLose(townId, 0, 'RaidDefense');
    await townReputationLose(townId, -5, 'RaidDefense');

    expect(updateGamestate).not.toHaveBeenCalled();
    expect(analyticsSendDesignEvent).not.toHaveBeenCalled();
  });

  it('does not throw when the town has no state entry', async () => {
    const state = { world: { towns: {} } } as unknown as GameState;
    vi.mocked(updateGamestate).mockImplementation(async (fn) => {
      fn(state);
    });

    await expect(
      townReputationLose(townId, 10, 'RaidDefense'),
    ).resolves.not.toThrow();
  });

  it('returns true when the loss crosses a tier threshold', async () => {
    const state = {
      world: { towns: { [townId]: { reputation: 110 } } },
    } as unknown as GameState;
    vi.mocked(updateGamestate).mockImplementation(async (fn) => {
      fn(state);
    });

    await expect(townReputationLose(townId, 20, 'RaidDefense')).resolves.toBe(
      true,
    );
  });

  it('returns false when the loss stays within the same tier', async () => {
    const state = {
      world: { towns: { [townId]: { reputation: 110 } } },
    } as unknown as GameState;
    vi.mocked(updateGamestate).mockImplementation(async (fn) => {
      fn(state);
    });

    await expect(townReputationLose(townId, 5, 'RaidDefense')).resolves.toBe(
      false,
    );
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
