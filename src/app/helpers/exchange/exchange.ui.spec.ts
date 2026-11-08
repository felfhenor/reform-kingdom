import type {
  EquipmentId,
  ExchangeNodeId,
  IsContentItem,
  ItemId,
} from '@interfaces';
import { beforeEach, describe, expect, it } from 'vitest';

import { ensureExchangeNode } from '@helpers/content/ensure-exchangenode';
import { ensureEquipment, ensureItem } from '@helpers/content/ensure-item';
import { ledgerMark } from '@helpers/engine/ledger';
import { exchangeInputHints } from '@helpers/exchange/exchange.ui';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';

describe('exchangeInputHints', () => {
  const coin = ensureItem({ id: 'coin' as ItemId, name: 'Coin' });
  const lucre = ensureItem({ id: 'lucre' as ItemId, name: 'Lucre' });
  const demonSword = ensureEquipment({
    id: 'demon-sword' as EquipmentId,
    name: 'Demonic Sword',
  });
  const purifiedSword = ensureEquipment({
    id: 'purified-sword' as EquipmentId,
    name: 'Purified Epee',
  });
  const coinExchange = {
    kind: 'Item' as const,
    input: { itemId: coin.id, required: 10 },
    output: { itemId: lucre.id, quantity: 1 },
    costs: [],
  };
  const node = ensureExchangeNode({
    id: 'altar' as ExchangeNodeId,
    name: 'Altar',
    exchanges: [
      {
        kind: 'Equipment',
        inputEquipmentId: demonSword.id,
        outputEquipmentId: purifiedSword.id,
        costs: [],
      },
      coinExchange,
      coinExchange,
    ],
  });

  beforeEach(() => {
    seedContent([
      coin,
      lucre,
      demonSword,
      purifiedSword,
      node,
    ] as IsContentItem[]);
  });

  it('lists each distinct input once with its sprite sheet', () => {
    seedGamestate();

    expect(
      exchangeInputHints(node).map((hint) => [hint.id, hint.spritesheet]),
    ).toEqual([
      [demonSword.id, 'equipment'],
      [coin.id, 'item'],
    ]);
  });

  it('only reveals inputs the player has discovered', () => {
    seedGamestate((state) => ledgerMark(state.discoveredMaterials, coin.id));

    expect(exchangeInputHints(node).map((hint) => hint.discovered)).toEqual([
      false,
      true,
    ]);
  });
});
