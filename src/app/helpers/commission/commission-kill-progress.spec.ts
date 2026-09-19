import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

import { commissionRecordMonsterKill } from '@helpers/commission/commission-kill-progress';
import { deepFreeze } from '@helpers/engine/deep-freeze';
import { gamestate, updateGamestate } from '@helpers/state-game';
import type {
  CaravanId,
  CommissionOfferId,
  CommissionRequirementMonsterKill,
  GameState,
  MonsterId,
  TownCommissionSlotId,
  TownId,
} from '@interfaces';

const caravanId = 'carrina-duchy' as CaravanId;
const townId = 'larsia' as TownId;
const sandWormId = 'sand-worm' as MonsterId;
const offerId = 'offer-a' as CommissionOfferId;

function withState(
  commissions: Record<string, unknown>,
  towns: Record<string, unknown> = {},
): void {
  vi.mocked(gamestate).mockReturnValue({
    world: { commissions, towns },
  } as unknown as GameState);
}

function frozenUpdate(index: number): (state: GameState) => GameState {
  const updateFn = vi.mocked(updateGamestate).mock.calls[index][0];

  return (state) => {
    deepFreeze(state.world?.commissions);
    return updateFn(state);
  };
}

describe('commissionRecordMonsterKill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does nothing when no commission has a kill requirement for this monster', () => {
    withState({
      [caravanId]: {
        commissionOfferId: offerId,
        requirements: [{ itemId: 'wergen-stick', quantity: 100 }],
        completed: false,
        generatedAt: 1000,
      },
    });

    commissionRecordMonsterKill(sandWormId);

    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('does nothing when the matching kill requirement is already fully satisfied', () => {
    withState({
      [caravanId]: {
        commissionOfferId: offerId,
        requirements: [{ monsterId: sandWormId, quantity: 5, progress: 5 }],
        completed: false,
        generatedAt: 1000,
      },
    });

    commissionRecordMonsterKill(sandWormId);

    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('does nothing when the matching commission is already completed', () => {
    withState({
      [caravanId]: {
        commissionOfferId: offerId,
        requirements: [{ monsterId: sandWormId, quantity: 5, progress: 1 }],
        completed: true,
        generatedAt: 1000,
      },
    });

    commissionRecordMonsterKill(sandWormId);

    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('increments progress on a matching, unsatisfied kill requirement', () => {
    withState({
      [caravanId]: {
        commissionOfferId: offerId,
        requirements: [{ monsterId: sandWormId, quantity: 5, progress: 1 }],
        completed: false,
        generatedAt: 1000,
      },
    });

    commissionRecordMonsterKill(sandWormId);

    const updateFn = frozenUpdate(0);
    const state = {
      world: {
        commissions: {
          [caravanId]: {
            commissionOfferId: offerId,
            requirements: [{ monsterId: sandWormId, quantity: 5, progress: 1 }],
            completed: false,
            generatedAt: 1000,
          },
        },
        towns: {},
      },
    } as unknown as GameState;
    const result = updateFn(state);

    expect(result.world.commissions[caravanId].requirements[0]).toEqual({
      monsterId: sandWormId,
      quantity: 5,
      progress: 2,
    });
  });

  it('replaces only the commissions that changed and keeps the rest by reference', () => {
    const matching = {
      commissionOfferId: offerId,
      requirements: [{ monsterId: sandWormId, quantity: 5, progress: 1 }],
      completed: false,
      generatedAt: 1000,
    };
    const unrelated = {
      commissionOfferId: offerId,
      requirements: [{ itemId: 'wergen-stick', quantity: 100 }],
      completed: false,
      generatedAt: 1000,
    };
    const otherCaravanId = 'other-caravan' as CaravanId;
    withState({ [caravanId]: matching, [otherCaravanId]: unrelated });

    commissionRecordMonsterKill(sandWormId);

    const state = {
      world: {
        commissions: { [caravanId]: matching, [otherCaravanId]: unrelated },
        towns: {},
      },
    } as unknown as GameState;
    const previous = state.world.commissions;
    const result = frozenUpdate(0)(state);

    expect(result.world.commissions).not.toBe(previous);
    expect(result.world.commissions[caravanId]).not.toBe(matching);
    expect(result.world.commissions[otherCaravanId]).toBe(unrelated);
  });

  it('does not reassign the commissions dict when only a town slot matched', () => {
    const unrelated = {
      commissionOfferId: offerId,
      requirements: [{ itemId: 'wergen-stick', quantity: 100 }],
      completed: false,
      generatedAt: 1000,
    };
    const slot = {
      id: 'slot-1' as TownCommissionSlotId,
      commissionOfferId: offerId,
      requirements: [{ monsterId: sandWormId, quantity: 5, progress: 1 }],
      generatedAtTick: 0,
    };
    withState(
      { [caravanId]: unrelated },
      { [townId]: { commissionSlots: [slot] } },
    );

    commissionRecordMonsterKill(sandWormId);

    const state = {
      world: {
        commissions: { [caravanId]: unrelated },
        towns: { [townId]: { commissionSlots: [{ ...slot }] } },
      },
    } as unknown as GameState;
    const previous = state.world.commissions;
    const result = frozenUpdate(0)(state);

    expect(result.world.commissions).toBe(previous);
  });

  it('replaces a town slot requirement instead of mutating the original object', () => {
    const slotId = 'slot-1' as TownCommissionSlotId;
    const requirement = { monsterId: sandWormId, quantity: 5, progress: 1 };
    withState(
      {},
      {
        [townId]: {
          commissionSlots: [{ id: slotId, requirements: [requirement] }],
        },
      },
    );

    commissionRecordMonsterKill(sandWormId);

    const originalRequirements = deepFreeze([{ ...requirement }]);
    const slot = { id: slotId, requirements: originalRequirements };
    const state = {
      world: {
        commissions: {},
        towns: { [townId]: { commissionSlots: [slot] } },
      },
    } as unknown as GameState;
    frozenUpdate(0)(state);

    expect(slot.requirements).not.toBe(originalRequirements);
    expect(slot.requirements[0].progress).toBe(2);
    expect(originalRequirements[0].progress).toBe(1);
  });

  it('caps progress at the requirement quantity instead of overflowing', () => {
    withState({
      [caravanId]: {
        commissionOfferId: offerId,
        requirements: [{ monsterId: sandWormId, quantity: 5, progress: 4 }],
        completed: false,
        generatedAt: 1000,
      },
    });

    commissionRecordMonsterKill(sandWormId, 10);

    const updateFn = frozenUpdate(0);
    const state = {
      world: {
        commissions: {
          [caravanId]: {
            commissionOfferId: offerId,
            requirements: [{ monsterId: sandWormId, quantity: 5, progress: 4 }],
            completed: false,
            generatedAt: 1000,
          },
        },
        towns: {},
      },
    } as unknown as GameState;
    const result = updateFn(state);

    expect(
      (
        result.world.commissions[caravanId]
          .requirements[0] as CommissionRequirementMonsterKill
      ).progress,
    ).toBe(5);
  });

  it('ignores a requirement for a different monster', () => {
    withState({
      [caravanId]: {
        commissionOfferId: offerId,
        requirements: [
          { monsterId: 'other-monster' as MonsterId, quantity: 5, progress: 1 },
        ],
        completed: false,
        generatedAt: 1000,
      },
    });

    commissionRecordMonsterKill(sandWormId);

    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('increments progress on a matching town commission slot', () => {
    const slotId = 'slot-1' as TownCommissionSlotId;
    withState(
      {},
      {
        [townId]: {
          commissionSlots: [
            {
              id: slotId,
              commissionOfferId: offerId,
              requirements: [
                { monsterId: sandWormId, quantity: 5, progress: 1 },
              ],
              generatedAtTick: 0,
            },
          ],
        },
      },
    );

    commissionRecordMonsterKill(sandWormId);

    expect(updateGamestate).toHaveBeenCalledTimes(1);
    const updateFn = frozenUpdate(0);
    const state = {
      world: {
        commissions: {},
        towns: {
          [townId]: {
            commissionSlots: [
              {
                id: slotId,
                commissionOfferId: offerId,
                requirements: [
                  { monsterId: sandWormId, quantity: 5, progress: 1 },
                ],
                generatedAtTick: 0,
              },
            ],
          },
        },
      },
    } as unknown as GameState;
    const result = updateFn(state);

    expect(
      result.world.towns[townId].commissionSlots[0].requirements[0],
    ).toEqual({ monsterId: sandWormId, quantity: 5, progress: 2 });
  });

  it('does nothing when no town slot has a matching unsatisfied kill requirement', () => {
    withState(
      {},
      {
        [townId]: {
          commissionSlots: [
            {
              id: 'slot-1' as TownCommissionSlotId,
              commissionOfferId: offerId,
              requirements: [
                { monsterId: sandWormId, quantity: 5, progress: 5 },
              ],
              generatedAtTick: 0,
            },
          ],
        },
      },
    );

    commissionRecordMonsterKill(sandWormId);

    expect(updateGamestate).not.toHaveBeenCalled();
  });
});
