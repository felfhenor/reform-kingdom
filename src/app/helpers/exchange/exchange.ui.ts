import { miscellaneousMessageLog } from '@helpers/combat/combat-log';
import { getEntry } from '@helpers/content/content';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { notifyError } from '@helpers/engine/notify';
import {
  applyCollectibleExchange,
  applyEquipmentExchange,
  applyItemExchange,
  exchangeArmoryCandidates,
  exchangeCanAfford,
  exchangedEquipmentItem,
  exchangeHasInput,
  exchangeIsOffered,
  exchangeNodeContent,
} from '@helpers/exchange/exchange';
import { equipmentItemDisplayName } from '@helpers/item/affix';
import { equippedItems } from '@helpers/item/equipment';
import { itemPreviewDisplay } from '@helpers/item/item-preview';
import {
  getMaterialQuantity,
  isMaterialDiscovered,
} from '@helpers/item/materials';
import { isEquipmentDiscovered } from '@helpers/kingdom/armory';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { taskEventCollectibleGained } from '@helpers/task/task-events';
import type {
  CollectibleContent,
  EquipmentContent,
  EquipmentItem,
  EquipmentItemId,
  ExchangeInputHint,
  ExchangeNodeContent,
  ExchangeNodeEquipmentExchange,
  ExchangeNodeItemExchange,
  ExchangeResult,
  ExchangeRow,
  ItemContent,
} from '@interfaces';
import { sortBy, uniqBy } from 'es-toolkit/compat';

const EXCHANGE_ERRORS: Record<Exclude<ExchangeResult, 'ok'>, string> = {
  missing: 'You no longer have what that exchange requires.',
  unaffordable: 'You cannot afford that exchange.',
  invalid: 'That exchange is no longer available.',
};

// True when the swap would drop a socketed gem - compared against the actual swap so affix-granted sockets count.
export function exchangeMayDestroyGems(
  item: EquipmentItem,
  outputItem: EquipmentItem,
): boolean {
  return item.infusedItemIds
    .slice(outputItem.infusedItemIds.length)
    .some((itemId) => !!itemId);
}

// Every exchange the player could start right now - one row per matching armory instance for equipment.
export function exchangeRows(node: ExchangeNodeContent): ExchangeRow[] {
  const state = gamestate();

  const rows = node.exchanges.flatMap(
    (exchange, exchangeIndex): ExchangeRow[] => {
      if (!exchangeIsOffered(state, exchange)) return [];

      const canAfford = exchangeCanAfford(state, exchange);
      if (exchange.kind === 'Collectible') {
        const collectible = getEntry<CollectibleContent>(
          exchange.outputCollectibleId,
        );
        if (!collectible) return [];

        return [
          {
            kind: 'Collectible',
            outputName: collectible.name,
            exchangeIndex,
            display: itemPreviewDisplay('collectible', collectible),
            costs: exchange.costs,
            canAfford,
          },
        ];
      }

      if (exchange.kind === 'Item') {
        return [
          {
            kind: 'Item',
            inputContent: getEntry<ItemContent>(exchange.input.itemId)!,
            inputName:
              getEntry<ItemContent>(exchange.input.itemId)?.name || 'UNKNOWN',
            outputContent: getEntry<ItemContent>(exchange.output.itemId)!,
            outputName:
              getEntry<ItemContent>(exchange.output.itemId)?.name || 'UNKNOWN',
            exchangeIndex,
            exchange,
            canAfford,
            owned: getMaterialQuantity(exchange.input.itemId),
          },
        ];
      }

      const inputContent = getEntry<EquipmentContent>(
        exchange.inputEquipmentId,
      );
      const outputContent = getEntry<EquipmentContent>(
        exchange.outputEquipmentId,
      );
      if (!inputContent || !outputContent) return [];

      return exchangeArmoryCandidates(state, exchange).map((item) => {
        const outputItem = exchangedEquipmentItem(
          item,
          exchange.outputEquipmentId,
        );

        return {
          kind: 'Equipment',
          exchangeIndex,
          item,
          inputContent,
          inputName: equipmentItemDisplayName(item, inputContent.name),
          outputItem,
          outputContent,
          outputName: equipmentItemDisplayName(outputItem, outputContent.name),
          costs: exchange.costs,
          canAfford,
          losesGems: exchangeMayDestroyGems(item, outputItem),
        };
      });
    },
  );

  return sortBy(rows, (row) => row.outputName);
}

// True when a hero is wearing gear this node could exchange, but none of it is in the armory.
export function exchangeHasOnlyEquippedInputs(
  node: ExchangeNodeContent,
): boolean {
  const state = gamestate();
  const equippedIds = new Set(
    state.world.party.flatMap((character) =>
      equippedItems(character.equipment).map((item) => item.equipmentId),
    ),
  );

  return node.exchanges.some(
    (exchange) =>
      exchange.kind === 'Equipment' &&
      equippedIds.has(exchange.inputEquipmentId) &&
      !exchangeHasInput(state, exchange),
  );
}

function exchangeInputHint(
  exchange: ExchangeNodeEquipmentExchange | ExchangeNodeItemExchange,
): ExchangeInputHint {
  const isEquipment = exchange.kind === 'Equipment';
  const id = isEquipment ? exchange.inputEquipmentId : exchange.input.itemId;
  const content = getEntry<EquipmentContent | ItemContent>(id);

  return {
    id,
    discovered: isEquipment
      ? isEquipmentDiscovered(exchange.inputEquipmentId)
      : isMaterialDiscovered(exchange.input.itemId),
    name: content?.name ?? 'UNKNOWN',
    spritesheet: isEquipment ? 'equipment' : 'item',
    sprite: content?.sprite ?? '',
  };
}

// Each distinct input the node accepts, so an empty exchange still hints at what to bring.
export function exchangeInputHints(
  node: ExchangeNodeContent,
): ExchangeInputHint[] {
  const withInputs = node.exchanges.filter(
    (exchange) => exchange.kind !== 'Collectible',
  );
  return uniqBy(withInputs.map(exchangeInputHint), 'id');
}

function exchangeVerb(nodeName: string): string {
  return exchangeNodeContent(nodeName)?.actionLabel ?? 'Exchange';
}

function exchangeAnalytics(nodeName: string, outputName: string): void {
  analyticsSendDesignEvent(
    `World:Exchange:${analyticsSafeSegment(nodeName)}:${analyticsSafeSegment(outputName)}`,
  );
}

export async function exchangePerformEquipment(
  nodeName: string,
  exchangeIndex: number,
  equipmentItemId: EquipmentItemId,
): Promise<boolean> {
  const item = gamestate().armory.find((owned) => owned.id === equipmentItemId);
  const inputContent = item
    ? getEntry<EquipmentContent>(item.equipmentId)
    : undefined;
  if (!item || !inputContent) {
    notifyError(EXCHANGE_ERRORS.missing);
    return false;
  }

  const oldName = equipmentItemDisplayName(item, inputContent.name);
  let result = 'invalid' as ExchangeResult;

  await updateGamestate((state) => {
    result = applyEquipmentExchange(
      state,
      nodeName,
      exchangeIndex,
      equipmentItemId,
    );
    return state;
  });

  if (result !== 'ok') {
    notifyError(EXCHANGE_ERRORS[result]);
    return false;
  }

  const newItem = gamestate().armory.find(
    (owned) => owned.id === equipmentItemId,
  )!;
  const outputContent = getEntry<EquipmentContent>(newItem.equipmentId)!;
  const newName = equipmentItemDisplayName(newItem, outputContent.name);
  miscellaneousMessageLog(
    `${exchangeVerb(nodeName)}: "${oldName}" became "${newName}".`,
  );
  exchangeAnalytics(nodeName, outputContent.name);

  return true;
}

export async function exchangePerformItem(
  nodeName: string,
  exchangeIndex: number,
): Promise<boolean> {
  let result = 'invalid' as ExchangeResult;

  await updateGamestate((state) => {
    result = applyItemExchange(state, nodeName, exchangeIndex);
    return state;
  });

  if (result !== 'ok') {
    notifyError(EXCHANGE_ERRORS[result]);
    return false;
  }

  const exchange = exchangeNodeContent(nodeName)?.exchanges[exchangeIndex];
  if (exchange?.kind !== 'Item') return true;

  const inputName =
    getEntry<ItemContent>(exchange.input.itemId)?.name ?? 'UNKNOWN';
  const outputName =
    getEntry<ItemContent>(exchange.output.itemId)?.name ?? 'UNKNOWN';
  miscellaneousMessageLog(
    `${exchangeVerb(nodeName)}: ${exchange.input.required.toLocaleString()}x ${inputName} became ${exchange.output.quantity.toLocaleString()}x ${outputName}.`,
  );
  exchangeAnalytics(nodeName, outputName);

  return true;
}

export async function exchangePerformCollectible(
  nodeName: string,
  exchangeIndex: number,
): Promise<boolean> {
  let result = 'invalid' as ExchangeResult;

  await updateGamestate((state) => {
    result = applyCollectibleExchange(state, nodeName, exchangeIndex);
    return state;
  });

  if (result !== 'ok') {
    notifyError(EXCHANGE_ERRORS[result]);
    return false;
  }

  const exchange = exchangeNodeContent(nodeName)?.exchanges[exchangeIndex];
  if (exchange?.kind !== 'Collectible') return true;

  const name =
    getEntry<CollectibleContent>(exchange.outputCollectibleId)?.name ??
    'UNKNOWN';
  miscellaneousMessageLog(`${exchangeVerb(nodeName)}: received ${name}.`);
  exchangeAnalytics(nodeName, name);
  void taskEventCollectibleGained(exchange.outputCollectibleId);

  return true;
}
