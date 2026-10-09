import { getEntry } from '@helpers/content/content';
import { ledgerMark } from '@helpers/engine/ledger';
import { equipmentItemSlotCount } from '@helpers/item/infusion';
import { applyMaterialDelta } from '@helpers/item/materials';
import {
  stateCanAffordCost,
  worldNodeSpendCost,
} from '@helpers/world-node/world-node-cost';
import type {
  CostItem,
  EquipmentId,
  EquipmentItem,
  EquipmentItemId,
  ExchangeNodeContent,
  ExchangeNodeEquipmentExchange,
  ExchangeNodeExchange,
  ExchangeNodeItemExchange,
  ExchangeResult,
  GameState,
  ItemId,
} from '@interfaces';

export function exchangeNodeContent(
  nodeName: string,
): ExchangeNodeContent | undefined {
  const content = getEntry<ExchangeNodeContent>(nodeName);
  return content?.__type === 'exchangenode' ? content : undefined;
}

// Armory only - equipped gear must be unequipped before it can be exchanged.
export function exchangeArmoryCandidates(
  state: GameState,
  exchange: ExchangeNodeEquipmentExchange,
): EquipmentItem[] {
  return state.armory.filter(
    (item) => item.equipmentId === exchange.inputEquipmentId,
  );
}

// Whether the player owns the exchange's input - costs are checked separately so unaffordable exchanges still show.
export function exchangeHasInput(
  state: GameState,
  exchange: ExchangeNodeExchange,
): boolean {
  if (exchange.kind === 'Equipment') {
    return exchangeArmoryCandidates(state, exchange).length > 0;
  }

  return (
    (state.materials[exchange.input.itemId]?.quantity ?? 0) >=
    exchange.input.required
  );
}

// Swaps only the base - never rerolls or adds affixes. Gems beyond the new base's slot count are dropped so they stop granting bonuses.
export function exchangedEquipmentItem(
  item: EquipmentItem,
  outputEquipmentId: EquipmentId,
): EquipmentItem {
  const swapped: EquipmentItem = { ...item, equipmentId: outputEquipmentId };
  swapped.infusedItemIds = item.infusedItemIds.slice(
    0,
    equipmentItemSlotCount(swapped),
  );

  return swapped;
}

function mergedCosts(costs: CostItem[]): CostItem[] {
  const byItem = new Map<ItemId, number>();
  costs.forEach((cost) =>
    byItem.set(cost.itemId, (byItem.get(cost.itemId) ?? 0) + cost.required),
  );
  return [...byItem].map(([itemId, required]) => ({ itemId, required }));
}

// Item exchanges consume their input alongside the costs; the input may also be listed in costs, so sum per item.
function exchangeTotalCosts(exchange: ExchangeNodeExchange): CostItem[] {
  return exchange.kind === 'Item'
    ? mergedCosts([...exchange.costs, exchange.input])
    : exchange.costs;
}

export function exchangeCanAfford(
  state: GameState,
  exchange: ExchangeNodeExchange,
): boolean {
  return stateCanAffordCost(state, exchangeTotalCosts(exchange));
}

function exchangeAt<K extends ExchangeNodeExchange['kind']>(
  nodeName: string,
  exchangeIndex: number,
  kind: K,
): Extract<ExchangeNodeExchange, { kind: K }> | undefined {
  const exchange = exchangeNodeContent(nodeName)?.exchanges[exchangeIndex];
  return exchange?.kind === kind
    ? (exchange as Extract<ExchangeNodeExchange, { kind: K }>)
    : undefined;
}

// Re-validates against live state since a UI-triggered write is deferred past the click's own checks.
export function applyEquipmentExchange(
  state: GameState,
  nodeName: string,
  exchangeIndex: number,
  equipmentItemId: EquipmentItemId,
): ExchangeResult {
  const exchange = exchangeAt(nodeName, exchangeIndex, 'Equipment');
  if (!exchange) return 'invalid';

  const armoryIndex = state.armory.findIndex(
    (item) => item.id === equipmentItemId,
  );
  const item = state.armory[armoryIndex];
  if (!item) return 'missing';
  if (item.equipmentId !== exchange.inputEquipmentId) return 'invalid';
  if (!exchangeCanAfford(state, exchange)) return 'unaffordable';

  state.armory[armoryIndex] = exchangedEquipmentItem(
    item,
    exchange.outputEquipmentId,
  );
  worldNodeSpendCost(state, exchange.costs);
  ledgerMark(state.discoveredEquipment, exchange.outputEquipmentId);

  return 'ok';
}

export function applyItemExchange(
  state: GameState,
  nodeName: string,
  exchangeIndex: number,
): ExchangeResult {
  const exchange: ExchangeNodeItemExchange | undefined = exchangeAt(
    nodeName,
    exchangeIndex,
    'Item',
  );
  if (!exchange) return 'invalid';
  if (!exchangeHasInput(state, exchange)) return 'missing';
  if (!exchangeCanAfford(state, exchange)) return 'unaffordable';

  worldNodeSpendCost(state, exchangeTotalCosts(exchange));
  applyMaterialDelta(state, exchange.output.itemId, exchange.output.quantity);

  return 'ok';
}
