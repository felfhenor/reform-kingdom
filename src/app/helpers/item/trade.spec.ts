import { beforeEach, describe, expect, it } from 'vitest';

import { combatLog, resetCombatLog } from '@helpers/combat/combat-log';
import { ensureEquipment, ensureItem } from '@helpers/content/ensure-item';
import {
  tradeArmoryHasRoom,
  tradeCommit,
  tradeEquipmentItemLogPart,
  tradeGoodsLogPart,
  tradeLog,
} from '@helpers/item/trade';
import { applyMaterialDelta } from '@helpers/item/materials';
import { gamestate } from '@helpers/state-game';
import type { EquipmentId, ItemId } from '@interfaces';
import { buildEquipmentItem } from '@/testing/builders';
import { seedContent } from '@/testing/content';
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

const copper = ensureItem({ id: 'copper' as ItemId, name: 'Copper Ore' });
const coins = ensureItem({ id: 'coins' as ItemId, name: 'Gold Coin' });
const blade = ensureEquipment({
  id: 'blade' as EquipmentId,
  name: 'Bronze Blade',
});

beforeEach(() => {
  seedContent([copper, coins, blade]);
  resetCombatLog();
});

describe('tradeGoodsLogPart', () => {
  it('folds an item quantity into its name', () => {
    expect(tradeGoodsLogPart({ itemId: copper.id }, 3)?.html).toMatch(
      /^@@icon@@3 .*copper ores/,
    );
  });

  it('prefixes a count onto multi-unit equipment, which carries none', () => {
    expect(tradeGoodsLogPart({ equipmentId: blade.id }, 1)?.html).toMatch(
      /^@@icon@@.*Bronze Blade/,
    );
    expect(tradeGoodsLogPart({ equipmentId: blade.id }, 2)?.html).toMatch(
      /^2x @@icon@@.*Bronze Blade/,
    );
  });

  it('skips goods with no content', () => {
    expect(tradeGoodsLogPart({}, 1)).toBeUndefined();
    expect(tradeGoodsLogPart({ itemId: 'gone' as ItemId }, 1)).toBeUndefined();
  });
});

describe('tradeEquipmentItemLogPart', () => {
  it('names the rolled instance with its equipment icon', () => {
    const part = tradeEquipmentItemLogPart(buildEquipmentItem(blade.id));

    expect(part?.html).toMatch(/^@@icon@@.*Bronze Blade/);
    expect(part?.icon?.spritesheet).toBe('equipment');
  });

  it('skips an instance whose content no longer exists', () => {
    expect(
      tradeEquipmentItemLogPart(buildEquipmentItem('gone' as EquipmentId)),
    ).toBeUndefined();
  });
});

describe('tradeLog', () => {
  it('logs goods and price with icons in token order', () => {
    tradeLog(
      'Larsia',
      'bought',
      [tradeGoodsLogPart({ equipmentId: blade.id }, 1)],
      [tradeGoodsLogPart({ itemId: coins.id }, 50)],
    );

    const [entry] = combatLog();
    expect(entry.kind).toBe('Miscellaneous');
    expect(entry.locationName).toBe('Larsia');
    expect(entry.message).toMatch(
      /^You bought @@icon@@.*Bronze Blade.* for @@icon@@50 .*gold coins.*\.$/,
    );
    expect(entry.itemIcons?.map((icon) => icon.spritesheet)).toEqual([
      'equipment',
      'item',
    ]);
  });

  it('omits the price clause when there is no price', () => {
    tradeLog('Larsia', 'claimed', [{ html: 'a thing' }], [undefined]);

    expect(combatLog()[0].message).toBe('You claimed a thing.');
  });

  it('logs nothing when no goods resolve', () => {
    tradeLog('Larsia', 'bought', [undefined], [{ html: '5 gold' }]);

    expect(combatLog()).toEqual([]);
  });
});
