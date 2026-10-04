import { describe, expect, it } from 'vitest';

import { ensureCommissionOffer } from '@helpers/content/ensure-commission';
import { pruneInvalidTownCommissionSlots } from '@helpers/town/town-commission-slots';
import type { CommissionOfferId, TownCommissionSlotId } from '@interfaces';
import { seedContent } from '@/testing/content';

const slotFor = (offerId: string) => ({
  id: `slot-${offerId}` as TownCommissionSlotId,
  commissionOfferId: offerId as CommissionOfferId,
  requirements: [],
  generatedAtTick: 0,
});

describe('pruneInvalidTownCommissionSlots', () => {
  it('drops slots whose offer is gone from content', () => {
    seedContent([
      ensureCommissionOffer({ id: 'offer-a' as CommissionOfferId }),
    ]);

    expect(
      pruneInvalidTownCommissionSlots([slotFor('offer-a'), slotFor('gone')]),
    ).toEqual([slotFor('offer-a')]);
  });
});
