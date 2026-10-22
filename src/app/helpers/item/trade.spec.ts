import { describe, expect, it } from 'vitest';

import { tradeArmoryHasRoom, tradeCommit } from '@helpers/item/trade';
import { applyMaterialDelta } from '@helpers/item/materials';
import { gamestate } from '@helpers/state-game';
import type { ItemId } from '@interfaces';
import { seedGamestate } from '@/testing/gamestate';
import { captureNotifications } from '@/testing/notify';

const ore = 'ore' as ItemId;

describe('tradeCommit', () => {
  it('applies the trade and reports success without a warning', async () => {
    seedGamestate();
    const notifications = captureNotifications();

    const executed = await tradeCommit((state) => {
      applyMaterialDelta(state, ore, 3);
      return 'executed';
    });

    expect(executed).toBe(true);
    expect(gamestate().materials[ore]?.quantity).toBe(3);
    expect(notifications).toEqual([]);
  });

  it('warns only for player-facing failures', async () => {
    seedGamestate();
    const notifications = captureNotifications();

    expect(await tradeCommit(() => 'rejected')).toBe(false);
    expect(await tradeCommit(() => 'armoryFull')).toBe(false);
    expect(await tradeCommit(() => 'vanished')).toBe(false);

    expect(notifications.map((n) => n.message)).toEqual([
      'Your armory is full.',
      'That item has disappeared from the shop.',
    ]);
  });
});

describe('tradeArmoryHasRoom', () => {
  it('passes with room and warns when full', () => {
    seedGamestate();
    const notifications = captureNotifications();

    expect(tradeArmoryHasRoom(1)).toBe(true);
    expect(tradeArmoryHasRoom(Number.MAX_SAFE_INTEGER)).toBe(false);
    expect(notifications.map((n) => n.message)).toEqual([
      'Your armory is full.',
    ]);
  });
});
