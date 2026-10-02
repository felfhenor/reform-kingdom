import { getEntry } from '@helpers/content/content';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { characterRecalculateStats } from '@helpers/hero/party';
import {
  canEquipItem,
  canModifyEquipment,
  equippedItems,
  slotsHoldingEquipment,
} from '@helpers/item/equipment';
import { planEquipmentOptimization } from '@helpers/item/equipment-optimize';
import {
  canInfuseEquipmentItem,
  infusionMaterialCost,
} from '@helpers/item/infusion';
import { applyMaterialDelta, spendGold } from '@helpers/item/materials';
import { armoryGet } from '@helpers/kingdom/armory';
import {
  gamestate,
  updateGamestate,
  worldPartyState,
} from '@helpers/state-game';
import {
  EquipmentTypeToSlot,
  type Character,
  type CharacterId,
  type EquipmentBlock,
  type EquipmentContent,
  type EquipmentItem,
  type EquipmentItemId,
  type EquipmentSlot,
  type GameState,
  type ItemContent,
  type ItemId,
  type JobContent,
} from '@interfaces';
import { taskEventEquipmentInfused } from '@helpers/task/task-events';

import { compact, uniqBy } from 'es-toolkit/compat';

function equipmentClearedSlots(
  equipment: EquipmentBlock,
  targetSlots: EquipmentSlot[],
  displacedItems: EquipmentItem[],
): Set<EquipmentSlot> {
  const clearedSlots = new Set<EquipmentSlot>(targetSlots);
  displacedItems.forEach((displacedItem) => {
    slotsHoldingEquipment(equipment, displacedItem.equipmentId).forEach(
      (slot) => clearedSlots.add(slot),
    );
  });
  return clearedSlots;
}

// Mutates `state`; reads displacement from it too, so chained equips in one callback see each other.
function stateEquipFromArmory(
  state: GameState,
  characterId: CharacterId,
  armoryItem: EquipmentItem,
  content: EquipmentContent,
): void {
  const character = state.world.party.find((c) => c.id === characterId);
  if (!character) return;

  const targetSlots = EquipmentTypeToSlot[content.type];
  // Deduped by instance id so the exact displaced item, infusions included, goes back to the armory once.
  const displacedItems = uniqBy(
    compact(targetSlots.map((slot) => character.equipment[slot])).filter(
      (item) => item.id !== armoryItem.id,
    ),
    'id',
  );

  const equipment = { ...character.equipment };
  equipmentClearedSlots(equipment, targetSlots, displacedItems).forEach(
    (slot) => (equipment[slot] = undefined),
  );
  targetSlots.forEach((slot) => (equipment[slot] = armoryItem));

  state.armory = [
    ...state.armory.filter((item) => item.id !== armoryItem.id),
    ...displacedItems,
  ];
  state.world.party = state.world.party.map((c) =>
    c.id === characterId ? characterRecalculateStats({ ...c, equipment }) : c,
  );
}

function sendEquipAnalytics(content: EquipmentContent): void {
  analyticsSendDesignEvent(
    `Hero:Equip:Item:${analyticsSafeSegment(content.name)}`,
  );
}

// Equips into every slot the item's type declares (e.g. two-handed fills Weapon+Offhand),
// fully displacing whatever occupied those slots (and any other slots they held) back to the armory as whole items.
export function characterEquipFromArmory(
  characterId: CharacterId,
  equipmentItemId: EquipmentItemId,
): boolean {
  if (!canModifyEquipment()) return false;

  const character = worldPartyState().find((c) => c.id === characterId);
  if (!character) return false;

  const armoryItem = armoryGet().find((item) => item.id === equipmentItemId);
  if (!armoryItem) return false;

  const equipmentContent = getEntry<EquipmentContent>(armoryItem.equipmentId);
  if (!equipmentContent || !canEquipItem(character, equipmentContent)) {
    return false;
  }

  updateGamestate((state) => {
    const item = state.armory.find((owned) => owned.id === equipmentItemId);
    if (item) stateEquipFromArmory(state, characterId, item, equipmentContent);
    return state;
  });

  sendEquipAnalytics(equipmentContent);
  return true;
}

// Plans inside the callback so every winner is applied against the same up-to-date draft.
export async function optimizeCharacterEquipment(
  characterId: CharacterId,
): Promise<void> {
  if (!canModifyEquipment()) return;

  const equipped: EquipmentContent[] = [];
  await updateGamestate((state) => {
    const character = state.world.party.find((c) => c.id === characterId);
    const job = character ? getEntry<JobContent>(character.jobId) : undefined;
    if (!character || !job) return state;

    planEquipmentOptimization(
      character,
      state.armory,
      job.statPriority,
    ).forEach(({ item, content }) => {
      stateEquipFromArmory(state, characterId, item, content);
      equipped.push(content);
    });
    return state;
  });

  equipped.forEach(sendEquipAnalytics);
}

// A two-hander fills several slots with the same instance.
export function replaceEquippedItemInstance(
  character: Character,
  item: EquipmentItem,
): Character {
  const equipment = { ...character.equipment };
  (Object.keys(equipment) as EquipmentSlot[]).forEach((slot) => {
    if (equipment[slot]?.id === item.id) equipment[slot] = item;
  });

  return characterRecalculateStats({ ...character, equipment });
}

export function stateEquippedItem(
  state: GameState,
  equipmentItemId: EquipmentItemId,
): EquipmentItem | undefined {
  return state.world.party
    .flatMap((character) => equippedItems(character.equipment))
    .find((item) => item.id === equipmentItemId);
}

export function stateOwnedEquipmentItem(
  state: GameState,
  equipmentItemId: EquipmentItemId,
): EquipmentItem | undefined {
  return (
    state.armory.find((item) => item.id === equipmentItemId) ??
    stateEquippedItem(state, equipmentItemId)
  );
}

// Mutates `state` - swaps the armory copy, or every hero slot holding the instance.
export function stateReplaceOwnedEquipmentItem(
  state: GameState,
  item: EquipmentItem,
): void {
  const armoryIndex = state.armory.findIndex((owned) => owned.id === item.id);
  if (armoryIndex !== -1) {
    state.armory[armoryIndex] = item;
    return;
  }

  state.world.party = state.world.party.map((character) =>
    equippedItems(character.equipment).some((owned) => owned.id === item.id)
      ? replaceEquippedItemInstance(character, item)
      : character,
  );
}

function sendInfuseAnalytics(materialItemId: ItemId): void {
  const materialContent = getEntry<ItemContent>(materialItemId);
  analyticsSendDesignEvent(
    materialContent
      ? `Hero:Infuse:Item:${analyticsSafeSegment(materialContent.name)}`
      : 'Hero:Infuse:Item',
  );
}

// Infuses a specific slot index (not "next open"); overwriting an already-filled slot is allowed with no refund for what was displaced.
export function equipmentInfuse(
  equipmentItemId: EquipmentItemId,
  slotIndex: number,
  materialItemId: ItemId,
): boolean {
  const state = gamestate();
  const item = stateOwnedEquipmentItem(state, equipmentItemId);
  if (!item) return false;
  if (stateEquippedItem(state, equipmentItemId) && !canModifyEquipment()) {
    return false;
  }
  if (!canInfuseEquipmentItem(item, slotIndex, materialItemId)) return false;

  const infusedItemIds = [...item.infusedItemIds];
  infusedItemIds[slotIndex] = materialItemId;
  const infusedItem: EquipmentItem = { ...item, infusedItemIds };
  const cost = infusionMaterialCost(materialItemId);

  updateGamestate((draft) => {
    stateReplaceOwnedEquipmentItem(draft, infusedItem);
    applyMaterialDelta(draft, materialItemId, -1);
    spendGold(draft, cost);
    return draft;
  });

  sendInfuseAnalytics(materialItemId);
  void taskEventEquipmentInfused();
  return true;
}
