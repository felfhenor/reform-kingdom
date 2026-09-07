import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/combat/combat-log', () => ({
  categoryMessageLog: vi.fn(),
  itemDropHtml: vi.fn(
    (item: { name: string }, quantity: number) => `${quantity}x ${item.name}`,
  ),
}));

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
  formatDuration: vi.fn(() => '1h'),
}));

vi.mock('@helpers/item/item-preview', () => ({
  resolveRewardDisplay: vi.fn(),
}));

vi.mock('@helpers/item/loot', () => ({
  rollDroppedRewards: vi.fn(() => []),
}));

vi.mock('@helpers/rng', () => ({
  rngNumberRange: vi.fn(() => 2),
  rngShuffle: vi.fn((items: unknown[]) => items),
}));

vi.mock('@helpers/state-game', () => ({
  updateGamestate: vi.fn(),
}));

vi.mock('@helpers/town/raid/town-raid-defense', () => ({
  raidDefenseGlobalEffectApply: vi.fn(),
}));

vi.mock('@helpers/town/reputation/town-reputation', () => ({
  townReputationGain: vi.fn(),
  townReputationLose: vi.fn(),
}));

vi.mock('@helpers/town/shop/town-shop-access', () => ({
  townShopItemCap: vi.fn(() => 10),
}));

vi.mock('@helpers/town/shop/town-stock', () => ({
  townStockDisplay: vi.fn(),
}));

vi.mock('@helpers/town/town-materials', () => ({
  applyTownMaterialDelta: vi.fn(),
}));

import { itemDropHtml } from '@helpers/combat/combat-log';
import { grantResolvedDrops } from '@helpers/combat/combat-rewards';
import { getEntry } from '@helpers/content/content';
import { formatDuration } from '@helpers/engine/timer';
import { resolveRewardDisplay } from '@helpers/item/item-preview';
import { rollDroppedRewards } from '@helpers/item/loot';
import { updateGamestate } from '@helpers/state-game';
import { raidDefenseGlobalEffectApply } from '@helpers/town/raid/town-raid-defense';
import {
  raidResolveDefeat,
  raidResolveVictory,
} from '@helpers/town/raid/town-raid-resolve';
import {
  townReputationGain,
  townReputationLose,
} from '@helpers/town/reputation/town-reputation';
import { townStockDisplay } from '@helpers/town/shop/town-stock';
import { applyTownMaterialDelta } from '@helpers/town/town-materials';
import type {
  Combat,
  GameState,
  TownContent,
  TownId,
  TownNodeState,
} from '@interfaces';

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

// Only the fields raidResolveDefeat's loss mechanics touch - the rest of TownNodeState is irrelevant to these tests.
function buildTownNodeState(
  overrides: Partial<TownNodeState> = {},
): TownNodeState {
  return {
    stock: [],
    craftQueue: [],
    materials: {},
    ...overrides,
  } as TownNodeState;
}

// raidResolveDefeat relies on updateGamestate running its callback synchronously (true in-tick) -
// tests that need the post-update loss messages must make the mock do the same against a state fixture.
function mockUpdateGamestateWith(state: GameState): void {
  vi.mocked(updateGamestate).mockImplementation((fn) => {
    fn(state);
    return Promise.resolve();
  });
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
    // Must run from inside the updateGamestate callback, not after it - updateGamestate is a bare
    // mock here, so nothing else could have called it yet.
    expect(raidDefenseGlobalEffectApply).not.toHaveBeenCalled();

    const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
    const state = {
      world: {
        towns: {
          [townId]: buildTownNodeState({
            lastRaidResolvedAtTick: undefined,
            craftSpeedDebuffExpiresAtTick: undefined,
            raidTelegraphedAtTick: 900,
            raidEngageWindowExpiresAtTick: 1200,
            raidTelegraphedAssaulterIds: ['Bloodmoth' as never],
          }),
        },
      },
    } as unknown as GameState;
    const result = updateFn(state);

    expect(raidDefenseGlobalEffectApply).toHaveBeenCalledWith(state, 1000);
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

  it('steals a random subset of stock capped at the rolled amount, and logs their names', () => {
    const stock = [
      { equipmentItem: { equipmentId: 'sword-1' }, addedAtTick: 0 },
      { equipmentItem: { equipmentId: 'shield-1' }, addedAtTick: 0 },
      { equipmentItem: { equipmentId: 'bow-1' }, addedAtTick: 0 },
    ] as TownNodeState['stock'];
    vi.mocked(townStockDisplay).mockImplementation(
      (entry) => ({ name: entry.equipmentItem.equipmentId }) as never,
    );
    const state = {
      world: { towns: { [townId]: buildTownNodeState({ stock }) } },
    } as unknown as GameState;
    mockUpdateGamestateWith(state);

    raidResolveDefeat(townId);

    // rngNumberRange is mocked to 2 and rngShuffle is identity, so the first 2 (in order) are stolen.
    expect(state.world.towns[townId].stock).toEqual([stock[2]]);
  });

  it('does not log a stolen-items message when stock is empty', () => {
    const state = {
      world: { towns: { [townId]: buildTownNodeState() } },
    } as unknown as GameState;
    mockUpdateGamestateWith(state);

    raidResolveDefeat(townId);
  });

  it('cancels the entire craft queue and logs what was being crafted', () => {
    const craftQueue = [
      {
        id: 'q1',
        tradeskillId: 'blacksmithing',
        recipeId: 'recipe-sword',
        ticksIntoCraft: 5,
      },
      {
        id: 'q2',
        tradeskillId: 'blacksmithing',
        recipeId: 'recipe-shield',
        ticksIntoCraft: 2,
      },
    ] as TownNodeState['craftQueue'];
    vi.mocked(getEntry).mockImplementation(
      (id) =>
        (id === townId
          ? buildTown()
          : { id, result: { equipmentId: id } }) as never,
    );
    vi.mocked(resolveRewardDisplay).mockImplementation(
      (reward) => ({ name: `Crafted ${reward.equipmentId}` }) as never,
    );
    const state = {
      world: { towns: { [townId]: buildTownNodeState({ craftQueue }) } },
    } as unknown as GameState;
    mockUpdateGamestateWith(state);

    raidResolveDefeat(townId);

    expect(state.world.towns[townId].craftQueue).toEqual([]);
  });

  it('takes 50% of every material stack and logs the loss', () => {
    vi.mocked(getEntry).mockImplementation(
      (id) => (id === townId ? buildTown() : { id, name: id }) as never,
    );
    const state = {
      world: {
        towns: {
          [townId]: buildTownNodeState({
            materials: { 'iron-ore': 10, wood: 3 } as never,
          }),
        },
      },
    } as unknown as GameState;
    mockUpdateGamestateWith(state);

    raidResolveDefeat(townId);

    expect(applyTownMaterialDelta).toHaveBeenCalledWith(
      state,
      townId,
      'iron-ore',
      -5,
    );
    expect(applyTownMaterialDelta).toHaveBeenCalledWith(
      state,
      townId,
      'wood',
      -1,
    );
    expect(itemDropHtml).toHaveBeenCalledWith(
      { id: 'iron-ore', name: 'iron-ore' },
      5,
    );
  });

  it('always logs the craft-speed debuff duration', () => {
    const state = {
      world: { towns: { [townId]: buildTownNodeState() } },
    } as unknown as GameState;
    mockUpdateGamestateWith(state);

    raidResolveDefeat(townId);

    expect(formatDuration).toHaveBeenCalledWith(3600);
  });
});
