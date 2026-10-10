import { miscellaneousMessageLog } from '@helpers/combat/combat-log';
import { getEntry } from '@helpers/content/content';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { notifyError } from '@helpers/engine/notify';
import { equipmentItemDisplayName } from '@helpers/item/affix';
import { stateOwnedEquipmentItem } from '@helpers/hero/character-equipment';
import { applyEquipmentReforge, isReforgeable } from '@helpers/item/reforge';
import { gamestate, updateGamestate } from '@helpers/state-game';
import type {
  EquipmentContent,
  EquipmentItem,
  EquipmentItemId,
  EquipmentReforgeResult,
} from '@interfaces';

export function isEquipmentItemReforgeable(item: EquipmentItem): boolean {
  const content = getEntry<EquipmentContent>(item.equipmentId);
  return !!content && isReforgeable(content);
}

export function reforgeMayDestroyGems(item: EquipmentItem): boolean {
  const baseSlots = getEntry<EquipmentContent>(item.equipmentId)?.slots ?? 0;
  return item.infusedItemIds.some(
    (itemId, index) => !!itemId && index >= baseSlots,
  );
}

const REFORGE_ERRORS: Record<Exclude<EquipmentReforgeResult, 'ok'>, string> = {
  missing: 'That item is no longer in your possession.',
  unaffordable: 'You cannot afford to reforge that item.',
  'in-combat': 'Equipped gear cannot be reforged during combat.',
  'not-reforgeable': 'That item cannot be reforged.',
};

export async function equipmentReforge(
  equipmentItemId: EquipmentItemId,
): Promise<boolean> {
  let result = 'missing' as EquipmentReforgeResult;

  const item = stateOwnedEquipmentItem(gamestate(), equipmentItemId)!;
  const content = getEntry<EquipmentContent>(item.equipmentId);
  if (!content) return false;

  const oldName = equipmentItemDisplayName(item, content.name);

  await updateGamestate((state) => {
    result = applyEquipmentReforge(state, equipmentItemId);
    return state;
  });

  if (result !== 'ok') {
    notifyError(REFORGE_ERRORS[result]);
    return false;
  }

  const newItem = stateOwnedEquipmentItem(gamestate(), equipmentItemId)!;
  const newName = equipmentItemDisplayName(newItem, content.name);
  miscellaneousMessageLog(`Reforged "${oldName}" into "${newName}".`);
  analyticsSendDesignEvent(
    `Kingdom:Reforge:${analyticsSafeSegment(content.name)}`,
  );

  return true;
}
