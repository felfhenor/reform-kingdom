import { describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content/content', () => ({
  getEntry: vi.fn(),
}));

import { pruneInvalidTownCommissionSlots } from '@helpers/town/town-commission-slots';
import { getEntry } from '@helpers/content/content';
import type {
  CommissionOfferContent,
  CommissionOfferId,
  TownCommissionSlotId,
} from '@interfaces';

describe('pruneInvalidTownCommissionSlots', () => {
  it('keeps a slot whose commissionOfferId still resolves to real content', () => {
    vi.mocked(getEntry).mockReturnValue({} as CommissionOfferContent);
    const slots = [
      {
        id: 'slot-1' as TownCommissionSlotId,
        commissionOfferId: 'offer-a' as CommissionOfferId,
        requirements: [],
        generatedAtTick: 0,
      },
    ];

    expect(pruneInvalidTownCommissionSlots(slots)).toEqual(slots);
  });

  it('drops a slot whose commissionOfferId no longer resolves to real content', () => {
    vi.mocked(getEntry).mockReturnValue(undefined);
    const slots = [
      {
        id: 'slot-1' as TownCommissionSlotId,
        commissionOfferId: 'offer-a' as CommissionOfferId,
        requirements: [],
        generatedAtTick: 0,
      },
    ];

    expect(pruneInvalidTownCommissionSlots(slots)).toEqual([]);
  });
});
