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
  planEquipmentOptimization,
  slotsHoldingEquipment,
} from '@helpers/item/equipment';
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

  const targetSlots = EquipmentTypeToSlot[equipmentContent.type];

  // Keyed by instance id so the exact displaced item, infusions included, goes back to the armory.
  const displacedItems = new Map<EquipmentItemId, EquipmentItem>();
  targetSlots.forEach((slot) => {
    const existing = character.equipment[slot];
    if (existing && existing.id !== armoryItem.id) {
      displacedItems.set(existing.id, existing);
    }
  });

  const clearedSlots = new Set<EquipmentSlot>(targetSlots);
  displacedItems.forEach((displacedItem) => {
    slotsHoldingEquipment(
      character.equipment,
      displacedItem.equipmentId,
    ).forEach((slot) => clearedSlots.add(slot));
  });

  updateGamestate((state) => {
    const armoryIndex = state.armory.findIndex(
      (item) => item.id === equipmentItemId,
    );
    if (armoryIndex === -1) return state;

    state.armory = [
      ...state.armory.filter((_, index) => index !== armoryIndex),
      ...Array.from(displacedItems.values()),
    ];

    state.world.party = state.world.party.map((c) => {
      if (c.id !== characterId) return c;

      const equipment = { ...c.equipment };
      clearedSlots.forEach((slot) => {
        equipment[slot] = undefined;
      });
      targetSlots.forEach((slot) => {
        equipment[slot] = armoryItem;
      });

      return characterRecalculateStats({ ...c, equipment });
    });

    return state;
  });

  analyticsSendDesignEvent(
    `Hero:Equip:Item:${analyticsSafeSegment(equipmentContent.name)}`,
  );
  return true;
}

// Backs the manual "Optimize Equipment" button; reclassing runs its own pass instead, to stay atomic with the job swap.
export function optimizeCharacterEquipment(characterId: CharacterId): void {
  const character = worldPartyState().find((c) => c.id === characterId);
  if (!character) return;

  const job = getEntry<JobContent>(character.jobId);
  if (!job) return;

  const winners = planEquipmentOptimization(
    character,
    armoryGet(),
    job.statPriority,
  );
  winners.forEach((winner) =>
    characterEquipFromArmory(characterId, winner.item.id),
  );
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
