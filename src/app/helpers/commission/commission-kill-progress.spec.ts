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
} from '@interfaces';

const caravanId = 'carrina-duchy' as CaravanId;
const sandWormId = 'sand-worm' as MonsterId;
const offerId = 'offer-a' as CommissionOfferId;

function withCommissions(commissions: Record<string, unknown>): void {
  vi.mocked(gamestate).mockReturnValue({
    world: { commissions },
  } as unknown as GameState);
}

describe('commissionRecordMonsterKill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does nothing when no commission has a kill requirement for this monster', () => {
    withCommissions({
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
    withCommissions({
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
    withCommissions({
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
    withCommissions({
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
      },
    } as unknown as GameState;
    const result = updateFn(state);

    expect(
      result.world.commissions[caravanId].requirements[0],
    ).toEqual({ monsterId: sandWormId, quantity: 5, progress: 2 });
  });

  it('caps progress at the requirement quantity instead of overflowing', () => {
    withCommissions({
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
      },
    } as unknown as GameState;
    const result = updateFn(state);

    expect(
      result.world.commissions[caravanId].requirements[0].progress,
    ).toBe(5);
  });

  it('ignores a requirement for a different monster', () => {
    withCommissions({
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
});
