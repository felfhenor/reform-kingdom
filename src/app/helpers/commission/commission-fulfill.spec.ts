import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/task/task-events');
vi.mock('@helpers/task/task-progress');

import {
  commissionCanFulfill,
  commissionExists,
  commissionFulfill,
  commissionRequirementEntries,
  commissionRewards,
} from '@helpers/commission/commission-fulfill';
import { ensureCaravan } from '@helpers/content/ensure-caravan';
import { ensureCommissionOffer } from '@helpers/content/ensure-commission';
import { ensureDroppedReward } from '@helpers/content/ensure-helpers-drops';
import {
  ensureCollectible,
  ensureEquipment,
  ensureItem,
} from '@helpers/content/ensure-item';
import { ensureMonster } from '@helpers/content/ensure-monster';
import { ensureWorker } from '@helpers/content/ensure-worker';
import {
  applyMaterialDelta,
  getMaterialQuantity,
} from '@helpers/item/materials';
import { armoryState, worldCommissionsState } from '@helpers/state-game';
import {
  taskEventCollectibleGained,
  taskEventWorkerRescued,
} from '@helpers/task/task-events';
import { taskRecordCommissionFulfilled } from '@helpers/task/task-progress';
import type {
  CaravanId,
  CollectibleId,
  CommissionOfferId,
  CommissionRequirement,
  EquipmentId,
  EquipmentItem,
  GameState,
  ItemId,
  MonsterId,
  WorkerId,
} from '@interfaces';
import { captureAnalyticsEvents } from '@/testing/analytics';
import {
  buildCommissionNodeState,
  buildEquipmentItem,
} from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';
import { locationOf, seedWorldNodes } from '@/testing/world';

const caravan = ensureCaravan({
  id: 'carrina-duchy' as CaravanId,
  name: 'Duchy Trading Caravan - Carrina',
});
const stick = ensureItem({
  id: 'wergen-stick' as ItemId,
  name: 'Wergen Stick',
});
const token = ensureItem({
  id: 'trader-token' as ItemId,
  name: 'Trader Token',
});
const sword = ensureEquipment({ id: 'sword' as EquipmentId, name: 'Sword' });
const worm = ensureMonster({ id: 'sand-worm' as MonsterId, name: 'Sand Worm' });
const medal = ensureCollectible({
  id: 'medal' as CollectibleId,
  name: 'Medal',
});
const nell = ensureWorker({ id: 'nell' as WorkerId, name: 'Nell' });
const offer = ensureCommissionOffer({
  id: 'offer-a' as CommissionOfferId,
  name: 'Bundle of Wergen Sticks',
  rewards: [
    ensureDroppedReward({ itemId: token.id, chance: 100, min: 2, max: 2 }),
    ensureDroppedReward({ collectibleId: medal.id, chance: 100 }),
    ensureDroppedReward({ workerId: nell.id, chance: 100 }),
  ],
});

const sticks: CommissionRequirement = { itemId: stick.id, quantity: 100 };

function seedCommission(
  requirements: CommissionRequirement[],
  edit: (state: GameState) => void = () => undefined,
  atCaravan = true,
): void {
  const { [caravan.name]: node, Field: field } = seedWorldNodes([
    { name: caravan.name, type: 'CaravanNode', x: 1 },
    { name: 'Field', type: 'ExploreNode', x: 2 },
  ]);
  seedGamestate((state) => {
    state.world.currentLocation = locationOf(atCaravan ? node : field);
    state.world.commissions[caravan.id] = buildCommissionNodeState({
      commissionOfferId: offer.id,
      requirements,
    });
    edit(state);
  });
}

const ownSticks =
  (quantity: number) =>
  (state: GameState): void =>
    applyMaterialDelta(state, stick.id, quantity);

function commission() {
  return worldCommissionsState()[caravan.id];
}

beforeEach(() => {
  vi.clearAllMocks();
  seedContent([caravan, stick, token, sword, worm, medal, nell, offer]);
});

describe('reading a commission', () => {
  it('reports nothing for a caravan without a rolled commission', () => {
    seedGamestate((state) => {
      state.world.commissions[caravan.id] = buildCommissionNodeState();
    });
    expect(commissionExists(caravan.id)).toBe(false);
    expect(commissionCanFulfill(caravan.id)).toBe(false);

    seedGamestate();
    expect(commissionExists(caravan.id)).toBe(false);
    expect(commissionCanFulfill(caravan.id)).toBe(false);
    expect(commissionRewards(caravan.id)).toEqual([]);
    expect(commissionRequirementEntries(caravan.id)).toEqual([]);
  });

  it('lists the offer rewards and each requirement against what the party has', () => {
    seedCommission([sticks], ownSticks(40));

    expect(commissionExists(caravan.id)).toBe(true);
    expect(commissionRewards(caravan.id)).toEqual(offer.rewards);
    expect(commissionRequirementEntries(caravan.id)).toEqual([
      expect.objectContaining({ content: stick, quantity: 100, owned: 40 }),
    ]);
  });
});

describe('commissionCanFulfill', () => {
  it('needs every item, armory piece and kill requirement met', () => {
    const swords = { equipmentId: sword.id, quantity: 1 };
    const kills = (progress: number) => ({
      monsterId: worm.id,
      quantity: 5,
      progress,
    });
    const withSword = (state: GameState) => {
      state.armory = [buildEquipmentItem(sword.id)];
    };

    seedCommission([sticks, swords, kills(5)], (state) => {
      ownSticks(100)(state);
      withSword(state);
    });
    expect(commissionCanFulfill(caravan.id)).toBe(true);

    seedCommission([sticks], ownSticks(99));
    expect(commissionCanFulfill(caravan.id)).toBe(false);

    seedCommission([swords]);
    expect(commissionCanFulfill(caravan.id)).toBe(false);

    seedCommission([kills(4)]);
    expect(commissionCanFulfill(caravan.id)).toBe(false);
  });

  it('is never fulfillable twice, but does not care where the party is', () => {
    seedCommission([sticks], ownSticks(100), false);
    expect(commissionCanFulfill(caravan.id)).toBe(true);

    seedCommission([sticks], (state) => {
      ownSticks(100)(state);
      state.world.commissions[caravan.id].completed = true;
    });
    expect(commissionCanFulfill(caravan.id)).toBe(false);
  });
});

describe('commissionFulfill', () => {
  it('spends the requirements, grants the rewards and completes the commission', async () => {
    seedCommission([sticks], ownSticks(100));
    const events = captureAnalyticsEvents();

    expect(await commissionFulfill(caravan.id)).toBe(true);

    expect(getMaterialQuantity(stick.id)).toBe(0);
    expect(getMaterialQuantity(token.id)).toBe(2);
    expect(commission().completed).toBe(true);
    expect(events).toContain(
      'Kingdom:Commission:Fulfill:Bundle of Wergen Sticks',
    );
    expect(taskRecordCommissionFulfilled).toHaveBeenCalledTimes(1);
    expect(taskEventCollectibleGained).toHaveBeenCalledWith(medal.id);
    expect(taskEventWorkerRescued).toHaveBeenCalledWith(nell.id);
  });

  it('hands over only the required armory pieces, and spends nothing for kills', async () => {
    const [first, second, other]: EquipmentItem[] = [
      buildEquipmentItem(sword.id),
      buildEquipmentItem(sword.id),
      buildEquipmentItem('other' as EquipmentId),
    ];
    seedCommission(
      [
        { equipmentId: sword.id, quantity: 2 },
        { monsterId: worm.id, quantity: 5, progress: 5 },
      ],
      (state) => (state.armory = [first, other, second]),
    );

    expect(await commissionFulfill(caravan.id)).toBe(true);

    expect(armoryState()).toEqual([other]);
  });

  it('refuses away from the caravan, or with requirements short, changing nothing', async () => {
    seedCommission([sticks], ownSticks(100), false);
    expect(await commissionFulfill(caravan.id)).toBe(false);

    seedCommission([sticks], ownSticks(99));
    expect(await commissionFulfill(caravan.id)).toBe(false);

    expect(getMaterialQuantity(stick.id)).toBe(99);
    expect(commission().completed).toBe(false);
    expect(taskRecordCommissionFulfilled).not.toHaveBeenCalled();
  });

  it('pays out once when two turn-ins race before either commits', async () => {
    seedCommission([sticks], ownSticks(200));

    const results = await Promise.all([
      commissionFulfill(caravan.id),
      commissionFulfill(caravan.id),
    ]);

    expect(results).toEqual([true, false]);
    expect(getMaterialQuantity(stick.id)).toBe(100);
    expect(getMaterialQuantity(token.id)).toBe(2);
  });
});
