import {
  ensureArray,
  ensureCostItem,
  ensureItemQuantity,
  ensureNodeBackground,
} from '@helpers/content/ensure-helpers-core';
import type {
  CollectibleId,
  EdictId,
  EquipmentId,
  ExchangeNodeCollectibleExchange,
  ExchangeNodeCollectibleTarget,
  ExchangeNodeContent,
  ExchangeNodeEquipmentTarget,
  ExchangeNodeExchange,
  ExchangeNodeId,
  ExchangeNodeItemExchange,
} from '@interfaces';

// Raw YAML may carry any variant's fields, so accept the union of every partial.
type RawExchange = Omit<
  Partial<ExchangeNodeItemExchange> & Partial<ExchangeNodeCollectibleExchange>,
  'kind' | 'input' | 'output'
> & {
  kind?: ExchangeNodeExchange['kind'];
  input?: Partial<
    ExchangeNodeItemExchange['input'] & ExchangeNodeEquipmentTarget
  >;
  output?: Partial<
    ExchangeNodeItemExchange['output'] &
      ExchangeNodeEquipmentTarget &
      ExchangeNodeCollectibleTarget
  >;
};

function ensureEquipmentTarget(
  target: Partial<ExchangeNodeEquipmentTarget> = {},
): ExchangeNodeEquipmentTarget {
  return { equipmentId: target.equipmentId ?? ('UNKNOWN' as EquipmentId) };
}

export function ensureExchangeNodeExchange(
  exchange: RawExchange = {},
): ExchangeNodeExchange {
  const costs = ensureArray(exchange.costs, ensureCostItem);

  if (exchange.kind === 'Collectible') {
    return {
      kind: 'Collectible',
      requiredEdictId: exchange.requiredEdictId ?? ('UNKNOWN' as EdictId),
      output: {
        collectibleId:
          exchange.output?.collectibleId ?? ('UNKNOWN' as CollectibleId),
      },
      costs,
    };
  }

  if (exchange.kind === 'Item') {
    return {
      kind: 'Item',
      input: ensureCostItem(exchange.input),
      output: ensureItemQuantity(exchange.output),
      costs,
    };
  }

  return {
    kind: 'Equipment',
    input: ensureEquipmentTarget(exchange.input),
    output: ensureEquipmentTarget(exchange.output),
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
    ...ensureNodeBackground(node),
    frames: node.frames ?? 0,
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
