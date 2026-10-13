import { describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/town/reputation/town-reputation-grant');

import { ensureCommissionOffer } from '@helpers/content/ensure-commission';
import { ensureItem } from '@helpers/content/ensure-item';
import { ensureTown } from '@helpers/content/ensure-town';
import { applyMaterialDelta } from '@helpers/item/materials';
import { townReputationGainAndRefresh } from '@helpers/town/reputation/town-reputation-grant';
import { townCommissionReputationReward } from '@helpers/town/town-commission-fulfill';
import { townCommissionFulfill } from '@helpers/town/town-commission-fulfill.ui';
import type {
  CommissionOfferId,
  ItemId,
  TownCommissionSlotId,
  TownId,
} from '@interfaces';
import { buildTownNodeState } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';
import { abilityJobContent, buildAbilityHero } from '@/testing/job-ability';
import { locationOf, seedWorldNodes } from '@/testing/world';

const town = ensureTown({ id: 'larsia' as TownId, name: 'Larsia' });
const slotId = 'slot-1' as TownCommissionSlotId;
const stick = ensureItem({ id: 'stick' as ItemId, name: 'Stick' });
const offer = ensureCommissionOffer({
  id: 'offer-a' as CommissionOfferId,
  name: 'Bundle of Sticks',
  townReputationReward: 25,
});

describe('townCommissionFulfill', () => {
  it('grants the same healer-boosted reputation the preview shows', async () => {
    seedContent([
      town,
      stick,
      offer,
      ...abilityJobContent('Healer', [['CommissionReputationBoost', 1, 0.2]]),
    ]);
    const entries = seedWorldNodes([
      { name: town.name, type: 'NonPlayerKingdom' },
    ]);
    seedGamestate((state) => {
      state.world.party = [buildAbilityHero('Healer', 1)];
      state.world.currentLocation = locationOf(entries[town.name]);
      state.world.towns[town.id] = buildTownNodeState({
        commissionSlots: [
          {
            id: slotId,
            commissionOfferId: offer.id,
            requirements: [{ itemId: stick.id, quantity: 1 }],
            generatedAtTick: 0,
          },
        ],
      });
      applyMaterialDelta(state, stick.id, 1);
    });

    const preview = townCommissionReputationReward(town.id, slotId);
    expect(preview).toBe(30);

    expect(await townCommissionFulfill(town.id, slotId)).toBe(true);
    expect(townReputationGainAndRefresh).toHaveBeenCalledWith(
      town.id,
      preview,
      'Commission',
    );
  });
});
