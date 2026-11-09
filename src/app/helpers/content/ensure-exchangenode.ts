import {
  ensureArray,
  ensureCostItem,
  ensureItemQuantity,
} from '@helpers/content/ensure-helpers-core';
import type {
  CollectibleId,
  EdictId,
  EquipmentId,
  ExchangeNodeCollectibleExchange,
  ExchangeNodeContent,
  ExchangeNodeEquipmentExchange,
  ExchangeNodeExchange,
  ExchangeNodeId,
  ExchangeNodeItemExchange,
} from '@interfaces';

// Raw YAML may carry any variant's fields, so accept the union of every partial.
type RawExchange = Partial<ExchangeNodeEquipmentExchange> &
  Partial<Omit<ExchangeNodeItemExchange, 'kind'>> &
  Partial<Omit<ExchangeNodeCollectibleExchange, 'kind'>>;

export function ensureExchangeNodeExchange(
  exchange: RawExchange = {},
): ExchangeNodeExchange {
  const costs = ensureArray(exchange.costs, ensureCostItem);

  if ((exchange.kind as string) === 'Collectible') {
    return {
      kind: 'Collectible',
      requiredEdictId: exchange.requiredEdictId ?? ('UNKNOWN' as EdictId),
      outputCollectibleId:
        exchange.outputCollectibleId ?? ('UNKNOWN' as CollectibleId),
      costs,
    };
  }

  if ((exchange.kind as string) === 'Item') {
    return {
      kind: 'Item',
      input: ensureCostItem(exchange.input),
      output: ensureItemQuantity(exchange.output),
      costs,
    };
  }

  return {
    kind: 'Equipment',
    inputEquipmentId: exchange.inputEquipmentId ?? ('UNKNOWN' as EquipmentId),
    outputEquipmentId: exchange.outputEquipmentId ?? ('UNKNOWN' as EquipmentId),
    costs,
  };
}

export function ensureExchangeNode(
  node: Partial<ExchangeNodeContent>,
): Required<ExchangeNodeContent> {
  return {
    id: node.id ?? ('UNKNOWN' as ExchangeNodeId),
    name: node.name ?? 'UNKNOWN',
    __type: 'exchangenode',
    description: node.description ?? 'UNKNOWN',
    hidden: node.hidden ?? false,
    invisibleUntilCollectibleIdsFound:
      node.invisibleUntilCollectibleIdsFound ?? [],
    emptyText: node.emptyText ?? 'Nothing here can be exchanged.',
    actionLabel: node.actionLabel ?? 'Exchange',
    exchanges: ensureArray(
      node.exchanges as RawExchange[] | undefined,
      ensureExchangeNodeExchange,
    ),
  };
}
