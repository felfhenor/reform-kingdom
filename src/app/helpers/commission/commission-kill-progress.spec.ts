import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

import { commissionRecordMonsterKill } from '@helpers/commission/commission-kill-progress';
import { gamestate, updateGamestate } from '@helpers/state-game';
import type {
  CaravanId,
  CommissionOfferId,
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

    const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
    const state = {
      world: {
        commissions: {
          [caravanId]: {
            commissionOfferId: offerId,
            requirements: [
              { monsterId: sandWormId, quantity: 5, progress: 1 },
            ],
            completed: false,
            generatedAt: 1000,
          },
        },
        towns: {},
      },
    } as unknown as GameState;
    const result = updateFn(state);

    expect(
      result.world.commissions[caravanId].requirements[0],
    ).toEqual({ monsterId: sandWormId, quantity: 5, progress: 2 });
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

    const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
    const state = {
      world: {
        commissions: {
          [caravanId]: {
            commissionOfferId: offerId,
            requirements: [
              { monsterId: sandWormId, quantity: 5, progress: 4 },
            ],
            completed: false,
            generatedAt: 1000,
          },
        },
        towns: {},
      },
    } as unknown as GameState;
    const result = updateFn(state);

    expect(
      result.world.commissions[caravanId].requirements[0].progress,
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
    const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
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
